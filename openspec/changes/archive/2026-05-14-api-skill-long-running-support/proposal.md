## Why

当前 API Skill 在调用上游 API 时，HTTP 请求没有显式配置超时时间。当被调用的上游 API 需要数分钟到数小时才能返回结果时，请求会在 Agent Core（axios）或 Skill Gateway（RestTemplate）侧长时间挂起，导致调用失败或资源泄漏。

需要为 API Skill 增加以下能力：
1. 按 Skill 配置 HTTP 超时时间，使同步调用可覆盖合理的等待范围（秒到分钟级）
2. 支持异步轮询模式，使系统能够处理提交任务后需轮询状态的长时间运行 API（分钟到小时级），轮询生命周期由 Skill Gateway 管理并持久化到数据库，避免 Agent Core 内存压力

## What Changes

- **新增 `timeoutSeconds` 配置字段**：在 `ExtendedSkillConfig` 中增加 `timeoutSeconds`（秒），控制 Agent Core → Gateway 和 Gateway → 外部 API 两段 HTTP 的超时。默认为 30 秒，不影响既有 Skill。
- **新增 `asyncPoll` 配置字段**：在 `ExtendedSkillConfig` 中增加 `asyncPoll` 异步轮询配置块，定义轮询端点、间隔、完成条件等。当该字段存在时，系统 SHALL 使用异步执行路径。
- **新增 `async_tasks` 数据库表**：在 MySQL 中新建表，记录每次异步 API 调用的状态、轮询配置、中间结果和最终结果。
- **新增 Gateway 异步任务轮询调度器**：`AsyncTaskPollingScheduler` 使用 Spring `@Scheduled` 定时扫描 `async_tasks` 表中 `PENDING`/`POLLING` 状态的任务，向外部 API 发起轮询请求并更新 DB 状态。
- **新增 API 端点**：
  - `POST /api/skills/api/async` — Agent Core 提交异步 API 请求，Gateway 执行初始调用后返回 `asyncTaskId`
  - `GET /api/skills/async-tasks/{id}/wait` — Agent Core 阻塞等待异步任务完成（Gateway 轮询 DB 直到状态变为终态或超时）
- **Gateway RestTemplate 按请求设置超时**：`ApiProxyService` 为每次出站 API 调用按 Skill 配置设置 connect/read timeout，不修改全局 RestTemplate 实例。
- **Agent Core 异步路径适配**：`executeConfiguredApiSkill` 检测到 `asyncPoll` 配置后，走新端点提交异步任务并等待结果，而非在 Node.js 进程中自行轮询。

## Capabilities

### New Capabilities
- `api-skill-timeout-config`: 按 Skill 配置 HTTP 超时，覆盖 Agent Core 和 Gateway 两段
- `api-skill-async-polling`: Gateway 托管的异步轮询模式，数据库持久化，支持长时间运行的上游 API

### Modified Capabilities
- 无现有能力变更。`timeoutSeconds` 未设置时默认 30 秒，`asyncPoll` 未设置时走同步路径，已有 Skill 行为不变。

## Impact

**受影响代码**：
- `backend/agent-core/src/tools/java-skills.ts` — `ExtendedSkillConfig` 接口扩展、`executeConfiguredApiSkill` 增加异步路径分支
- `backend/skill-gateway/src/main/java/.../config/SkillGatewayHttpClientConfig.java` — 支持按请求创建带超时的 RestTemplate
- `backend/skill-gateway/src/main/java/.../service/ApiProxyService.java` — `callApi` 接受 `timeoutSeconds` 参数
- `backend/skill-gateway/src/main/java/.../controller/SkillController.java` — 新增 `POST /api/skills/api/async` 和 `GET /api/skills/async-tasks/{id}/wait` 端点
- `backend/skill-gateway/src/main/java/.../service/AsyncTaskPollingService.java` — **新增** 轮询调度与执行服务
- `backend/skill-gateway/src/main/java/.../entity/AsyncTask.java` — **新增** 实体
- `backend/skill-gateway/src/main/resources/schema-mysql.sql` — **新增** `async_tasks` 表定义

**API 变更**：
- 新增 `POST /api/skills/api/async` — 请求体含 `url`/`method`/`headers`/`body`/`timeoutSeconds`/`asyncPoll`，返回 `{ asyncTaskId, status }`
- 新增 `GET /api/skills/async-tasks/{id}/wait?timeoutMs=N` — 返回 `{ status, result, errorMessage }`
- `POST /api/skills/api` — 请求体增加可选字段 `timeoutSeconds`

**依赖变化**：无新增第三方依赖
