## 为什么

异步任务通知中心存在 3 个用户体验 / 稳定性问题，2026-06-03 用户反馈：

### 问题 1：通知中心时间显示比实际慢 8 小时
- 现象：通知中心列表/详情展示的时间比真实北京时间慢 8 小时
- 根因：内网 MySQL 容器时区是 UTC，DTO 的 LocalDateTime 字段被 Jackson 序列化为无时区字符串（如 `"2026-06-03T05:53:25"`），前端 `new Date()` 按本地时区（CST）解析 → 误把 05:53 当作 CST 时间显示
- **v2.1 约束**：用户明确要求"不要新增参数配置给我，你改代码实现就行"——不能用 `-Duser.timezone=UTC` 启动参数或 `spring.jackson.time-zone=UTC` 配置项。**只用代码改动**（MyBatis-Plus 显式 UTC + DTO @JsonFormat）来强制对齐

### 问题 2：长任务（5-10 分钟）支持不足
- 现象：用户调用一个 POST 接口，第三方需要 5-10 分钟才返回结果，async_task 卡在 PENDING 状态等 30 分钟超时
- 根因：当前 scheduler 每 30s 主动 POST 一次轮询地址（`poll_endpoint`），但**有些第三方接口不提供轮询地址**——只能发起一次调用，等最后响应
- 这类接口**调用一次后必须等 HTTP 响应挂起到 5-10 分钟**，不能用周期性轮询
- 当前架构还有 3 个隐性风险：**线程池会被长请求占满（DoS）**、**JVM 崩溃后任务永远卡 SINGLE_CALLED**、**PERIODIC↔SINGLE_CALL 状态转换存在竞态可能重复发起**

### 问题 3：agent 重复调用第三方把人家服务搞坏
- 现象：用户反馈"不止是调用了两次接口，甚至调用了很多次，agent 一直在调用，实际上调用的接口已经在第三方平台执行了"
- 根因 v1：`/api/skills/api/async` 没有去重，每次都新建 AsyncTask
- 根因 v2：v2 设计在 `externalTaskId` 提取之后才去重——但**此时第三方已经被打了**。agent 在 ReAct 循环里调用 N 次 → 第三方被打 N 次
- 根因 v2.1：v2.1 用 `(userId, requestSignature)` + 60s 窗口——LLM 在同一对话里 > 60s 再调 → 窗口过期 → 第三方被打第二次
- 根因 v2.2：**"第一次调就有返回，不要在一个对话里面调用多次"**——v2.1 仍然有漏洞，COMPLETED 状态的任务不再被去重
- **v2.2 修复**：去重键加上 `sessionId` → 同一对话里的重复调用**全部拦截**；窗口延至 1 小时；**任意状态**都视为重复
- 副作用：用户反馈"原先的消息条数展示的逻辑没有问题，点击已读后消息就没有了"——**badge 逻辑完全不动**，砍掉 v2 加的 `activeCount` 双状态方案

## What Changes

### 1. 通知中心时间显示修复（2 层时区修复，**纯代码改动**）

只改 DTO `@JsonFormat` 在生产里**不可靠**——2 个时钟源（写入侧 / 序列化侧）必须强制对齐。**不允许新增任何配置项**。

| 层 | 作用 | 代码改动 |
|---|---|---|
| L3 | MyBatis-Plus 自动填充显式写 UTC | `MybatisPlusConfig.metaObjectHandler` 用 `LocalDateTime.now(ZoneOffset.UTC)` |
| L4 | DTO 字段显式 UTC + Z 后缀 | `@JsonFormat(pattern=..., timezone="UTC")` 输出 Z 后缀 |

**前端**：
- 新增 `frontend/src/utils/datetime.ts` 公共模块，提供 `parseBackendTimeAsUtc(s)` 工具
- 把字符串规范化为带时区 ISO 8601；解析失败返回 `null`；调用方 fallback 到原字符串
- `TaskNotificationBell.vue` 的 `fmtTime` / `fmtFullTime` 改用新工具

### 2. 兼容"无轮询地址的长任务"（SINGLE_CALL）

#### 2a. 数据模型
- `async_tasks` 加 `poll_strategy` VARCHAR(20) NOT NULL DEFAULT 'PERIODIC'
  - `PERIODIC`：周期性轮询（当前行为）
  - `SINGLE_CALL`：只调用一次 `poll_endpoint`，等 5-10 分钟响应
- `async_tasks` 加 `single_call_read_timeout_seconds` INT DEFAULT NULL
  - SINGLE_CALL 模式 HTTP read timeout（秒）；NULL 时回退到 `maxWaitSeconds`
  - 跟 `maxWaitSeconds` 解耦：前者是 PERIODIC 总超时，后者是 SINGLE_CALL 单次读超时
- 自动 schema 迁移：`SchemaMigrationRunner` 检测 + ALTER TABLE

#### 2b. 实体 / Mapper / DTO
- `AsyncTask` 加 `pollStrategy` + `singleCallReadTimeoutSeconds` 字段
- `AsyncTaskNotificationDto` 加 `pollStrategy` 字段（无 `@JsonFormat`）
- DTO 的 `from()` 工厂方法必须给新字段赋值

#### 2c. Scheduler 改造（修竞态 + 独立线程池）

**状态转换顺序修正**（修复 v1 竞态）：SINGLE_CALL 模式下 `PENDING→SINGLE_CALLED` 转换**必须在** `findPendingOrPolling` 扫描范围之外，且跳过 `PENDING→POLLING` 中间态。

**独立线程池**（修复 DoS）：PERIODIC 用固定线程池（20），SINGLE_CALL 用 CachedThreadPool——避免长请求占满 PERIODIC 资源。

**新枚举值**：`SINGLE_CALLED`（进行中过渡态，"已发起，等响应中"）。`findPendingOrPolling` 不扫此状态。

**SINGLE_CALL 异常处理**：
- `SocketTimeoutException`（read timeout 到期）→ 标 `TIMEOUT`（业务超时）
- 其他网络异常 → 标 `FAILED`
- 拿到响应后 → 走正常 `evaluateCompletion` 流程

#### 2d. 启动恢复机制（修复 v1 无恢复漏洞）

新增 `StartupRecoveryRunner`，启动时把卡住的 SINGLE_CALLED 任务标 FAILED：
- 条件：`status='SINGLE_CALLED' AND started_at < NOW() - INTERVAL 30 MINUTE`
- 30 分钟阈值**写死在代码里**（`STUCK_SINGLE_CALL_MINUTES` 常量，**不加配置**）

#### 2e. ApiProxyService（**复用现有重载，不引入新签名**）

- **不**加新方法（v1 提议的 `Integer readTimeoutMs` 会与现有 `int timeoutSeconds` 编译冲突）
- 复用现有 5 参数 `callApi(url, method, headers, body, int timeoutSeconds)` 重载
- scheduler 传 `singleCallReadTimeoutSeconds ?? maxWaitSeconds ?? 600`（**单位秒**），内部 `* 1000` 转毫秒

#### 2f. 审计日志
- `GATEWAY_POLL_START` 的 `extraJson` 加 `pollStrategy` 字段（不改 event type）

### 3. 修复重复异步任务 bug（去重在调第三方之前）

**用户原话**："你看不止是调用了两次接口，甚至调用了很多次，agent 一直在调用，实际上调用的接口已经在第三方平台执行了，你这样调用会把人家服务搞坏的。"

**位置**：`SkillController.callApiAsync` 在 `asyncPoll` 校验之后、**调用第三方之前**就做去重。

**去重键**：`(user_id, request_signature)`。

**签名算法**（[RequestSignatureUtil](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/util/RequestSignatureUtil.java)）：
```
signature = SHA-256(
    method + "|" +
    url + "|" +
    canonicalJson(body) + "|" +
    idJsonPath + "|" +
    pollMethod + "|" +
    pollEndpoint
)
```
`canonicalJson(body)` 递归排序 key（保证 LLM 传参顺序差异不影响签名）。

**去重窗口**：写死 60 秒（`DedupConfig.WINDOW_SECONDS` 常量，**不加新配置**）。60 秒内同 `(user, signature)` 的**任意状态任务**都视为重复。

**去重行为**：查到匹配任务 → **直接返回既有 `asyncTaskId` + deduped: true**，**不调第三方**、**不创建新任务**、**不动既有任务状态**。

**新列**：`async_tasks.request_signature VARCHAR(64)` —— SHA-256 hex + 索引 `idx_async_user_sig_time (user_id, request_signature, created_at)`。

**Mapper 新增**：`findRecentBySignature(userId, signature, windowSeconds)`。

**审计**：写一条 `DUPLICATE_REQUEST` 审计日志。

### 4. 任务 id 保持现状

- `async_tasks.id` 跟 `async_polling_audit_logs.async_task_id` 物理上必须一致（外键约束保证）
- 用户已确认保持现有逻辑
- 上线前跑一次校验 SQL：返回 0 行才发布

### 5. **不**做：badge 一致性改造

用户明确说"原先的消息条数展示的逻辑没有问题，点击已读后消息就没有了"——v2 加的 `activeCount` 双状态方案**整块砍掉**。`countUnreadByUser` / `findByUserAndAsyncPoll` / `/my/unread-count` 接口**完全不变**。

## Capabilities

### 新增能力

- `async-task-single-call-mode`：支持"无轮询地址 + 长响应"的第三方接口；配套独立线程池、启动恢复、状态机竞态修复
- `async-task-timezone-display-fix`：通知中心时间字段显示为北京时间（**2 层时区修复，纯代码改动，不加任何配置**）
- `async-task-idempotent-submit`：异步任务提交按 `(user, sessionId, requestSignature)` **per-session 1 小时内**去重；**任意状态都视为重复**（PENDING / COMPLETED / FAILED 全部算）；**在调第三方之前拦截**——防止 LLM 重试 / 前端重复点击 / 网络重传把人家服务搞坏

### 修改的能力

- `async-task-notification-frontend`：时间显示组件解析后端 ISO 8601 字符串（`parseBackendTimeAsUtc` 移到 `utils/datetime.ts`）
- `async-task-scheduler`：SINGLE_CALL 分支；独立线程池；启动恢复机制
- `async-task-gateway-api`：callApiAsync 端点**调第三方之前**的幂等去重

### **未修改**的能力（用户已确认原状 OK）

- 通知中心 badge / drawer 逻辑、`/my/unread-count` 接口、`countUnreadByUser` 方法、click-ack 后消息消失的流程 —— **完全不变**

## Impact

### 数据库
- `async_tasks` 加 `poll_strategy` 列（VARCHAR(20) DEFAULT 'PERIODIC'）
- `async_tasks` 加 `single_call_read_timeout_seconds` 列（INT DEFAULT NULL）
- `async_tasks` 加 `request_signature` 列（VARCHAR(64) DEFAULT NULL）+ 索引 `idx_async_user_session_sig_time (user_id, session_id, request_signature, created_at)`
- 已有数据：自动迁移补列 + 默认值填充；老数据 `request_signature` 全部为 NULL（**不影响**，新查询 WHERE 条件会过滤 NULL）
- 索引 / 触发器：本次新增 1 个联合索引

### 后端
- `MybatisPlusConfig`：`LocalDateTime.now(ZoneOffset.UTC)`（**改代码，不加配置**）
- `application.properties`：**完全不动**（不加 `spring.jackson.time-zone`）
- 启动脚本 / Dockerfile：**完全不动**（不加 `-Duser.timezone=UTC`）
- `AsyncTask` 实体：加 3 字段（`pollStrategy` / `singleCallReadTimeoutSeconds` / `requestSignature`）
- `AsyncTaskMapper`：INSERT 同步加列；新增 `findRecentBySignature` / `recoverStuckSingleCallTasks`
- `AsyncTaskPollingService`：新增 `findRecentBySignature` 封装
- `AsyncTaskPollingScheduler`：分支判断 `pollStrategy`；独立线程池；修竞态
- `AsyncTaskNotificationDto`：加 `pollStrategy` 字段；4 个时间字段 `@JsonFormat` 改 UTC+Z
- `SchemaMigrationRunner`：自动检测 + ALTER 3 列 + 1 索引
- `StartupRecoveryRunner`（**新文件**）：启动时恢复卡住的 SINGLE_CALLED
- `RequestSignatureUtil`（**新文件**）：SHA-256 签名计算工具类
- `DedupConfig`（**新文件**）：写死 `PER_SESSION_WINDOW_SECONDS = 3600` + `NO_SESSION_WINDOW_SECONDS = 60` 两个常量
- `SkillController.callApiAsync`：**重组**——步骤 2（去重）在步骤 3（调第三方）**之前**
- **状态枚举新增**：`SINGLE_CALLED`
- `ApiProxyService`：**完全不改**
- 通知中心相关接口（`/my` / `/my/unread-count` / `countUnreadByUser`）：**完全不改**

### 前端
- `frontend/src/utils/datetime.ts`（**新文件**）：`parseBackendTimeAsUtc` 公共工具
- `TaskNotificationBell.vue`：import 公共工具；`statusColor` 加 `SINGLE_CALLED`；详情弹窗加"轮询策略"行
- `useAsyncTaskNotifications.ts`：类型加 `pollStrategy` / `SINGLE_CALLED`
- **通知中心 badge / drawer 视觉**：**完全不变**

### 配置 / 部署
- **不加任何环境变量**
- **不加任何 `application.properties` 配置**
- **不加任何 JVM 启动参数**
- **不加任何第三方依赖**
- 老库**自动迁移**（`SchemaMigrationRunner` 启动时检测并 ALTER）

### 兼容性
- ✅ 老数据 `poll_strategy` 默认 `PERIODIC` → 行为完全不变
- ✅ 老数据 `request_signature` 为 NULL → 新去重查询 WHERE 条件过滤掉，**不影响**
- ✅ 老 skill 没指定 `poll_strategy` 字段时 → 创建时默认 `PERIODIC`
- ✅ 通知中心前端 HMR 升级，老缓存不影响
- ✅ `/api/skills/api/async` 响应字段兼容；老调用方不读 `deduped` 字段也不报错
- ✅ `/api/async-tasks/my/unread-count` 响应**完全不变**
- ✅ 通知中心 badge 逻辑**完全不变**
- ✅ `ApiProxyService` 重载**全部保留**
- ✅ PERIODIC 路径代码**一行不改**
- ✅ 没有 JVM 启动参数 / 配置文件项需要运维改
