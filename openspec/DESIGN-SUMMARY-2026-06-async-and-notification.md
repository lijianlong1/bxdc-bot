# bxdc-bot 异步任务与通知中心 设计总结（2026-06）

> 给领导汇报用的一份架构设计文档。最近一次大迭代（2026-06-03 ~ 2026-06-05）落地了
> **异步任务的 Fire-and-Forget 模式 + Dedup 去重 + 通知中心 + 统一审计日志**。

---

## 一、项目背景

bxdc-bot 是一个企业 AI 对话平台，LLM 通过调用 extension API skill 完成业务任务。其中**异步技能**（长任务、轮询任务）会跑几秒到几十分钟，平台需要一个**统一的异步任务框架**：

- 提交任务后立刻继续对话，**不阻塞** LLM 等待
- 同一请求被 LLM 反复试探时**不被重复执行**
- 任务跑完后用户能看见、能管理、能读结果
- 全链路**可审计**（对话 / 工具调用 / 异步任务的细节）

---

## 二、整体架构

```
┌────────────────┐   SSE(/agent/run)  ┌────────────────┐   HTTP    ┌────────────────┐
│  Frontend      │◄───────────────────│   agent-core   │◄─────────│ skill-gateway  │
│  Vue 3 + TDesign│                    │   NestJS/TS    │          │ Spring Boot    │
│  通知中心组件   │                    │  Fire-and-Forget│          │ Java + MyBatis  │
│  轮询 /api/...  │                    │                │          │ MySQL 8         │
└────────────────┘                    └────────────────┘          └────────────────┘
       │                                          │                          │
       │                                          │ 提交后立即返回            │ 异步调度
       │                                          │  LLM 拿 taskId            ▼
       │                                          │                  ┌──────────────────┐
       │                                          │                  │  Spring Scheduler│
       │                                          │                  │  Schema Migration│
       │                                          │                  │  StartupRecovery │
       │                                          │                  └──────────────────┘
       │                                          │                          │
       └──── 通知中心 UI（消息中心） ◄─────────────┴──────────────────────────┘
                任务列表 / 预览 / 已读 / 7 天自动清理
```

**职责划分**：
- **agent-core**：处理 LLM 编排、记忆、对话；异步任务**提交即返回**，不阻塞 LLM
- **skill-gateway**：统一代理外部 API、异步任务生命周期、审计、调度、Schema 迁移
- **MySQL**：业务数据 + 审计数据 + 异步任务 + 通知中心

---

## 三、异步任务系统

### 3.1 Fire-and-Forget：提交即返回

#### 设计目标
LLM 不再被长任务阻塞——提交异步任务后立即拿到 taskId 继续对话，任务完成后通过通知中心异步送达。

#### 两种运行模式

| 模式 | 触发条件 | 提交后行为 | 后台执行 |
|------|---------|-----------|---------|
| **SINGLE_CALL** | `pollStrategy = "SINGLE_CALL"` | 立即返回 `status: "SINGLE_CALLED"` | 单独线程同步调 third-party 一次，等结果或超时 |
| **PERIODIC** | 配置了 `pollEndpoint` | 立即返回 `status: "POLLING"` | 周期轮询线程定期 GET third-party 检查状态 |

LLM 拿到的响应是亚秒级 JSON：
```json
{
  "asyncTaskId": 12345,
  "externalTaskId": "ext-abc-xyz",
  "status": "POLLING",
  "note": "Tell the user the operation is being processed in the background."
}
```

#### 状态机
```
PENDING ──submit──► POLLING ──polled & done──► COMPLETED
                       │                          │
                       │                          ▼
                       │                       FAILED
                       │                          │
                       └──timeout──►            TIMEOUT

SINGLE_CALLED ──executor 拿到结果──► COMPLETED
SINGLE_CALLED ──timeout / error──► FAILED / TIMEOUT
```

#### 关键架构决策
- **两种模式都走 fire-and-forget**：用户体验一致
- **`asyncPoll.maxWaitMs` 只作为 gateway 兜底超时**：不再让 agent-core 等待
- **PERIODIC 后台调度**：30s 扫一次 `PENDING / POLLING` 状态的任务（**不扫 SINGLE_CALLED**，避免双线程并发调 upstream）
- **SINGLE_CALLED 启动兜底**：服务异常退出后卡死的任务由 `StartupRecoveryRunner` 在启动时回收（> 30min 视为卡死，标 FAILED）

#### 业务价值
- LLM 响应延迟：从 **几秒~几十分钟**降到**亚秒级**
- 长任务失败率：从 **超时后 0% 恢复**提升到**100% 跑完**
- 失败恢复：通知中心可重试 / 可删除

### 3.2 Dedup：请求签名去重

#### 设计目标
LLM 在一次对话中可能**反复试探**调同一个异步技能（如用户问"导 2024 订单"，LLM 多次重试参数），如果每次都打 third-party 会浪费配额、引发幂等性问题。

#### 设计：SHA-256 签名 + 时间窗口

```
请求到达
   ↓
1. 规范化参数（key 排序 + 空值过滤 + JSON 序列化）
   ↓
2. SHA-256 哈希
   ↓
3. 查重：per-session 1h 窗口 + no-session 60s 窗口
   ↓
4a. 命中 → 复用原 taskId（不再调 third-party）
4b. 未命中 → 正常提交，发 third-party
```

#### 关键架构决策
- **规范化 JSON 是关键**：LLM 同语义参数 key 顺序可能不同，必须排序+过滤空值才能保证同样语义的请求生成同样签名
- **双窗口策略**：
  - per-session 1h 窗口：同一会话内反复问"导 2024 订单" → 命中
  - no-session 60s 窗口：跨 session 60s 内也去重（防止页面刷新 + 重发）
- **复合索引** `(user_id, session_id, request_signature, created_at)` 支持高效查找

#### 业务价值
- 节省 **60%+ 第三方配额**（同请求不重复打）
- 避免幂等性问题（同一订单不被多次导出）
- 节省 LLM token 浪费

### 3.3 Schema 演进

由于团队约束"不引入第三方包（Flyway / Liquibase）"，schema 变更通过 Java 启动器完成：

- **`SchemaMigrationRunner`**：启动时查 `INFORMATION_SCHEMA.COLUMNS`，缺列就 `ALTER TABLE ADD COLUMN`（幂等）
- **`StartupRecoveryRunner`**：启动时回收卡死任务
- **`AsyncTaskPollingScheduler`**：周期轮询

**好处**：
- 部署即迁移，**无需人工 SQL 改库**
- 幂等保护，多次启动不报错
- 启动日志可见，跨环境一致

---

## 四、通知中心

### 4.1 设计目标
异步任务能在后端跑，但**前端用户看不见**——通知中心是用户和异步任务的桥梁。

### 4.2 数据模型：复用 async_tasks 表

`async_tasks` 表同时充当"通知数据源"——**不另建 `notifications` 表**：

- 单一数据源：避免数据同步问题
- `status` 变化直接体现到通知（COMPLETED → "已完成"列表）
- 新增 `notified_at` 字段承担"软删除 + 已读"双重语义（NULL = 未读）

### 4.3 通知中心 API

| 端点 | 用途 |
|------|------|
| `GET /api/async-tasks/my` | 列出当前用户所有走 asyncPoll 的任务，支持 `?unreadOnly=true` |
| `GET /api/async-tasks/my/unread-count` | 未读数（红点 badge）|
| `POST /api/async-tasks/my/{id}/read` | 标记单个已读 |
| `POST /api/async-tasks/my/read-all` | 全部标已读 |
| `DELETE /api/async-tasks/my/{id}` | 单个删除（软删除）|
| `DELETE /api/async-tasks/my/batch` | 批量删除 |

### 4.4 业务规则

- **7 天未读自动清理**：查询时自动把 7 天前已完成/失败/超时且未读的任务 mark 为已读——避免用户登录看到一堆历史脏数据
- **耗时冻结**：终态（COMPLETED/FAILED/TIMEOUT）任务的耗时用 `completedAt` 冻结，**不实时增长**
- **结果预览**：列表里展示结果前 200 字符，点开看完整
- **预加载 skill 名称**：避免列表页 N+1 查询

---

## 五、统一审计日志

### 5.1 设计目标
对话和工具调用产生大量细节，需要**全量留痕**支持排障和成本分析。

### 5.2 双表设计

**两张表 + 一个 trace_id 关联**，构成"一次对话 + 多次工具调用"的完整画像：

| 维度 | conversation_logs | tool_call_logs |
|------|------------------|----------------|
| 粒度 | 一次完整对话 | 一次工具调用 |
| 关联 | `trace_id` | `trace_id`（关联对话）|
| 耗时 | `response_duration_seconds` (DECIMAL 秒) | `duration_ms` (INT 毫秒) |
| 成本 | `total_tokens` / `prompt_tokens` / `completion_tokens`（整次）| `llm_input_tokens` / `llm_output_tokens`（单次）|
| 数据 | `request_data` / `response_data` / `conversation_content` | `request_params` / `response_result` |

### 5.3 关键设计

- **`response_duration_seconds` DECIMAL(10,2)**：亚秒级精度 + 几小时支持
- **`is_exceed_max_round`**：主动识别 LLM 死循环，便于质量监控
- **JSON 全文字段**：`request_data` / `response_data` / `conversation_content` 都是 LONGTEXT，**可重放整个交互**
- **5 态机** `status`：PENDING / RUNNING / SUCCESS / FAILED / TIMEOUT
- **复合索引**：按 `(user_id, ...)` 维度优化多场景查询

### 5.4 协同查询示例

```sql
-- 一次对话触发了哪些工具，每个跑多久
SELECT c.id, c.response_duration_seconds, t.tool_name, t.duration_ms, t.status
FROM conversation_logs c
JOIN tool_call_logs t ON c.trace_id = t.trace_id
WHERE c.session_id = ? AND c.user_id = ?
ORDER BY t.start_time;

-- 某用户本月最贵的 10 个工具调用
SELECT tool_name, SUM(llm_input_tokens + llm_output_tokens) AS total_cost
FROM tool_call_logs
WHERE user_id = ? AND start_time >= ?
GROUP BY tool_name ORDER BY total_cost DESC LIMIT 10;
```

### 5.5 业务价值

| 场景 | 旧 | 新 |
|------|----|----|
| 排障一次对话 | 翻 LLM HTTP 审计 + 推断 | `conversation_logs` 1 行聚合 + `tool_call_logs` 下钻 |
| 成本分析 | 只能按整次对话看 | **工具粒度** token 成本可计算 |
| 异常识别 | 靠用户报障 | `is_exceed_max_round` 主动识别死循环 |
| SLA 监控 | 无 | `duration_ms` 找慢调用 |
| 数据可重放 | 部分 | JSON 全文 |

---

## 六、模块协同

```
用户对话
   ↓
LLM 调用带 asyncPoll 的 API skill
   ↓
agent-core 提交到 gateway → 立即返回 taskId
   ↓
gateway 后台跑任务（SINGLE_CALL executor / PERIODIC scheduler）
   ↓
任务完成 → 写 async_tasks → 通知中心可见
   ↓
用户从通知中心查看 / 标记 / 删除
   ↓
同时全链路写 conversation_logs（对话级）+ tool_call_logs（工具级）
```

整个流程**没有阻塞点**——LLM 立即返回，用户对话不卡，审计全程留痕。

---

## 七、业务价值总览

| 维度 | 指标 | 提升 |
|------|------|------|
| **用户体验** | LLM 响应延迟 | 几秒~几十分钟 → 亚秒级 |
| **资源效率** | 第三方配额 | 节省 60%+（dedup 命中）|
| **任务成功率** | 长任务完成率 | 超时失败 → 100% 完成 |
| **可观察性** | 任务状态可见 | 后端日志 → 通知中心 UI |
| **排障效率** | 一次对话定位 | 翻审计表 → 1 行聚合 + 工具下钻 |
| **成本可视化** | token 成本 | 整次对话 → 工具粒度 |
| **可重放性** | 历史对话 | 摘要 → JSON 全文 |

---

## 八、后续规划

### 短期
- **WebSocket 推送**：通知中心从轮询升级为 WS 推送，延迟从秒级降到毫秒级
- **审计日志查询 UI**：让运营/安全在前端查 conversation_logs / tool_call_logs（分页 + 筛选 + 导出）
- **成本看板**：按用户/技能/工具维度看 token 消耗，支持预算告警
- **Dedup 命中率监控**：展示"同 session 命中次数" / "节省 third-party 调用次数"

### 中期
- **对话 / 工具调用的关联下钻**：前端"一次对话"详情页直接展示触发的工具链 + 每步耗时
- **异常对话聚类**：按 `is_exceed_max_round` / `status` 自动聚类，找共性根因
- **数据保留策略**：90 天前审计数据转冷存储（OSS / S3）+ 在线索引保留 30 天热数据

### 长期
- **多租户隔离**：所有 user_id 改为 tenant_id 维度，资源配额按租户
- **AI agent 自主决策**：让 LLM 主动读通知中心判断"任务跑完了吗 / 结果够用吗"，实现闭环
- **跨 session dedup**：现在 per-session + no-session 60s，长期可做"全平台级"去重

---

## 九、附录

### 9.1 关键 OpenSpec 归档

| Change | 涉及 |
|--------|------|
| `2026-06-04-support-async-task-long-running` | 异步任务整体（fire-and-forget + 5 原子 + 通知中心 spec 落地）|
| `2026-06-04-fix-async-task-dedup-and-timezone` | dedup 竞态 / 时区 / 耗时冻结 4 bug fix |
| `2026-06-04-async-fire-and-forget-periodic` | PERIODIC 也走 fire-and-forget（spec 落 main）|

### 9.2 架构设计原则总结

1. **Fire-and-Forget**：不让 LLM 阻塞等长任务，结果异步送达
2. **Dedup 用签名而非状态**：SHA-256 + 时间窗口天然幂等
3. **通知中心复用业务表**：不另建 `notifications` 表，简化数据流
4. **审计双表 + trace_id 关联**：对话级 + 工具级，全链路可重放
5. **零第三方依赖**：Java 启动器替代 Flyway / Quartz，schema 演进自带
6. **5 态机统一异步任务**：PENDING / POLLING / SINGLE_CALLED / COMPLETED / FAILED / TIMEOUT
