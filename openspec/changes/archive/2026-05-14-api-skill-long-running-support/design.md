## Context

当前 API Skill 的调用链路为：

```
Agent Core (TypeScript)                     Skill Gateway (Java)
  executeConfiguredApiSkill()                SkillController.callApi()
    → axios.post(/api/skills/api, {...})      → BuiltinToolExecutionService.callExternalApi()
                                               → ApiProxyService.callApi()
                                                 → RestTemplate.exchange(upstreamApiUrl)
```

该链路中两处 HTTP 调用均**没有显式超时**：
1. axios 未设置 `timeout` 参数
2. RestTemplate 的 `HttpComponentsClientHttpRequestFactory` 未设置 `connectTimeout` / `readTimeout`

当上游 API 耗时较长（分钟到小时级），两处调用都可能永久阻塞。

在初版设计中，异步轮询逻辑放在 Agent Core（Node.js 进程内存）中执行。但若有大量并发的长时间轮询任务，Agent Core 的内存和事件循环压力会显著上升。此外，Agent Core 重启会导致所有进行中的轮询任务丢失。

因此，本设计将轮询生命周期迁移到 Skill Gateway（Java），并以数据库持久化状态。

## Goals / Non-Goals

**Goals:**
- 支持按 Skill 配置 HTTP 超时，同时作用于 Agent Core 和 Gateway 两侧
- 支持异步轮询模式，轮询生命周期由 Gateway 管理，状态持久化到 MySQL
- Agent Core 仅负责提交异步任务和等待结果，不持有轮询状态
- 未配置时保持向后兼容，默认 30 秒超时不破坏既有 Skill

**Non-Goals:**
- 不支持 WebSocket/SSE 实时推送轮询进度（可后续迭代）
- 不覆盖 SSH/COMPUTE 类型 Skill 的超时（仅 API Skill）
- 不支持跨 Gateway 实例的分布式任务调度（单实例 Gateway 足够）

## Decisions

### 1. 异步轮询架构：Gateway 托管 + DB 持久化

**选择**：异步轮询生命周期由 Skill Gateway 全权管理，使用 `async_tasks` 数据库表记录状态。

**流程图**：
```
Agent Core                                Gateway                                 DB              外部 API
    │                                        │                                     │                  │
    │ POST /api/skills/api/async             │                                     │                  │
    │ {url, method, headers, body,          │                                     │                  │
    │  timeoutSeconds, asyncPoll}            │                                     │                  │
    ├───────────────────────────────────────►│                                     │                  │
    │                                        │ POST {external_url} (初始调用)        │                  │
    │                                        ├─────────────────────────────────────────────────────────►│
    │                                        │◄──────────── {id: "task-xyz"} ───────────────────────────┤
    │                                        │                                     │                  │
    │                                        │ INSERT async_tasks                   │                  │
    │                                        │ (status=PENDING,                     │                  │
    │                                        │  external_task_id=task-xyz,          │                  │
    │                                        │  polling_config, ...)                │                  │
    │                                        ├─────────────────────────────────────►│                  │
    │                                        │                                     │                  │
    │◄─ { asyncTaskId: 42, status: PENDING } │                                     │                  │
    │                                        │                                     │                  │
    │ GET /async-tasks/42/wait?timeoutMs=300000                                     │                  │
    ├───────────────────────────────────────►│                                     │                  │
    │                                        │ (blocking)                           │                  │
    │                                        │ ┌─ check DB → status=PENDING         │                  │
    │                                        │ │ (sleep 2s)                         │                  │
    │                     ┌──────────────────┤ │                                    │                  │
    │                     │ @Scheduled 扫描  │ │                                    │                  │
    │                     │ PENDING/POLLING  │ │                                    │                  │
    │                     │ 任务 → 轮询上游   │ │                                    │                  │
    │                     │                  │ │                                    │                  │
    │                     │ GET {pollEndpoint}│ │                                   │                  │
    │                     ├──────────────────────────────────────────────────────────────────────────►│
    │                     │◄─── {status: "completed", result: {...}} ───────────────────────────────┤
    │                     │                  │ │                                    │                  │
    │                     │ UPDATE status=   │ │                                    │                  │
    │                     │ COMPLETED,       │ │                                    │                  │
    │                     │ poll_result=...  │ │                                    │                  │
    │                     ├──────────────────┤►│                                    │                  │
    │                                        │ │ check DB → status=COMPLETED         │                  │
    │                                        │ │ return result →                     │                  │
    │◄── { status: COMPLETED, result: ... }  │                                     │                  │
```

**理由**：
- Gateway（Java）多线程模型更适合管理大量并发轮询任务
- 数据库持久化确保 Gateway 重启后任务可恢复
- Agent Core 无状态，重启不影响进行中的异步任务
- 轮询调度器 `@Scheduled` 可控制并发度和资源消耗

### 2. 轮询调度策略：Spring @Scheduled + 并发控制

**选择**：使用 `@Scheduled(fixedDelayString = "${skill.async.polling.scheduler-interval-ms:30000}")` 定时扫描 `async_tasks` 表，扫描间隔可配置（默认 30 秒），选取需要轮询的任务，使用固定大小的线程池并发执行。

**扫描 SQL**：
```sql
SELECT * FROM async_tasks
WHERE status IN ('PENDING', 'POLLING')
  AND (last_polled_at IS NULL OR TIMESTAMPDIFF(SECOND, last_polled_at, NOW()) >= poll_interval_seconds)
ORDER BY created_at ASC
LIMIT 50
```

**理由**：
- `@Scheduled` 简单可靠，无需引入 Quartz 等重量级调度框架
- 扫描间隔通过 `application.yml` 中的 `skill.async.polling.scheduler-interval-ms` 配置（默认 30000ms），运维可按需调整
- 按 `poll_interval_seconds` 过滤避免过度轮询
- `LIMIT 50` 防止一次扫描处理过多任务导致调度周期延迟
- 线程池固定大小（默认 20 线程，可通过配置调整）控制对上游 API 的并发压力

### 3. Agent Core 等待结果的方式：Gateway 阻塞等待端点

**选择**：Agent Core 调用 `GET /api/skills/async-tasks/{id}/wait?timeoutMs=N`，Gateway 在 `timeoutMs` 时间内轮询 DB（每 2 秒查一次），直到状态变为终态（COMPLETED/FAILED/TIMEOUT）或超时。

**理由**：
- Agent Core 只需一次 HTTP 调用，实现简单
- 无需在 Agent Core 中维护轮询定时器
- Gateway 的 DB 轮询开销极小（每 2 秒一次 SELECT BY ID）
- 复用 Agent Core 现有的 HTTP 错误处理逻辑

**替代方案**：Agent Core 自行轮询 Gateway 状态端点
- 拒绝理由：增加 Agent Core 复杂度，且需自行处理超时和重试

### 4. 数据库表设计：`async_tasks`

**选择**：新建 `async_tasks` 表，包含任务配置、状态、中间结果和最终结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | 自增 ID |
| `skill_id` | BIGINT | 关联的 Skill ID |
| `user_id` | VARCHAR(64) | 发起用户 |
| `external_task_id` | VARCHAR(255) | 上游 API 的任务 ID |
| `poll_endpoint` | VARCHAR(1024) | 已替换 `{id}` 的轮询 URL |
| `poll_method` | VARCHAR(16) | 轮询 HTTP method，默认 GET |
| `poll_interval_seconds` | INT | 轮询间隔（秒），默认 5 |
| `max_wait_seconds` | INT | 最大等待时间（秒） |
| `completion_json_path` | VARCHAR(255) | 完成状态字段路径 |
| `completion_value` | VARCHAR(64) | 完成时的字段值 |
| `failed_values` | TEXT | JSON 数组，失败状态值列表 |
| `result_json_path` | VARCHAR(255) | 结果提取路径 |
| `poll_headers` | TEXT | JSON，轮询请求头 |
| `initial_response` | MEDIUMTEXT | 初始 API 响应 |
| `poll_result` | MEDIUMTEXT | 最终轮询结果 |
| `status` | VARCHAR(32) | PENDING/POLLING/COMPLETED/FAILED/TIMEOUT |
| `error_message` | TEXT | 错误描述 |
| `last_polled_at` | DATETIME | 最近一次轮询时间 |
| `started_at` | DATETIME | 首次轮询开始时间 |
| `completed_at` | DATETIME | 终态时间 |
| `created_at` | DATETIME | 记录创建时间 |
| `updated_at` | DATETIME | 记录更新时间 |

**索引**：`idx_status`（status）、`idx_skill_id`（skill_id）

### 5. 超时配置传递：Agent Core → Gateway → RestTemplate

**选择**：Agent Core 在 `POST /api/skills/api`（同步）或 `POST /api/skills/api/async`（异步初始请求）的请求体中携带 `timeoutSeconds`。Gateway 的 `ApiProxyService.callApi()` 根据该值按请求创建带超时的 `RestTemplate`。

**理由**：
- 不能修改全局 `gatewayRestTemplate` bean，并发请求超时不同会互相干扰
- 使用 `SimpleClientHttpRequestFactory` 设置 `connectTimeout`/`readTimeout`，创建成本极低

### 6. 异步初始请求的超时处理

异步模式的初始 API 调用（获取 task ID）仍使用同步 HTTP，受 `timeoutSeconds` 控制。若初始调用超时，Gateway 不创建 `async_task` 记录，直接向 Agent Core 返回错误。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 轮询任务积压导致调度器压力过大 | 可配置扫描间隔（默认 30s）+ 线程池（默认 20 线程）+ LIMIT 50，超出部分下次调度处理 |
| `async_tasks` 表数据无限增长 | 定期清理已完成/失败/超时超过 7 天的记录（清理逻辑可后续迭代） |
| Gateway 重启导致轮询暂停 | 重启后 `@Scheduled` 重新触发，扫描 DB 中未完成的任务继续轮询 |
| 并发轮询对上游 API 造成压力 | 线程池 + 按 `poll_interval_seconds` 控制单个任务的轮询频率 |
| 多个 Agent Core 等待同一任务 | 阻塞等待端点查询 DB 是无状态的，天然支持 |

## Migration Plan

**部署步骤**：
1. 执行 DDL 创建 `async_tasks` 表
2. 部署 Gateway（新增实体 + Service + Controller 端点 + 调度器）
3. 部署 Agent Core（扩展 `ExtendedSkillConfig`、新增异步路径分支）
4. 在既有 API Skill 上验证：不加新字段时行为无变化

**回滚策略**：
- `async_tasks` 表无其他功能依赖，可直接保留或删除
- Agent Core / Gateway 的新代码路径仅在配置了 `asyncPoll` 时触发，不配置即回退

**验证清单**：
- [ ] 未配置新字段的既有 API Skill 行为与变更前一致
- [ ] 配置 `timeoutSeconds: 10` 后，超时请求正确返回错误
- [ ] 配置 `asyncPoll` 后，异步任务正常完成、失败检测、超时终止
- [ ] Gateway 重启后，未完成的轮询任务恢复执行
- [ ] 并发提交多个异步任务互不干扰

## Open Questions

1. 是否需要在前端 UI 中展示异步任务状态？
   - 初步判断：后端优先，前端可后续迭代

2. `async_tasks` 历史数据保留策略？
   - 建议 7 天自动清理，后续在 `@Scheduled` 中增加清理任务

3. 轮询请求是否需要支持与初始请求不同的鉴权？
   - `poll_headers` 默认复用初始 headers，`includeHeaders`（默认 true）控制
