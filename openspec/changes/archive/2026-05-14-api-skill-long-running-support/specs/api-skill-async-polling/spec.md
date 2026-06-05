## ADDED Requirements

### Requirement: Gateway 托管的异步轮询模式

系统 SHALL 支持在 Skill 的 `configuration` 中通过 `asyncPoll` 字段声明异步轮询模式，用于处理返回任务 ID 后需要轮询结果的上游 API（例如提交批量任务、数据导出等场景，上游 API 响应包含 `task_id`，后续需轮询状态直至完成）。

轮询生命周期 MUST 由 Skill Gateway 管理，状态 SHALL 持久化到 `async_tasks` 数据库表中。Agent Core MUST NOT 在自身进程内存中持有轮询状态或执行轮询循环。

#### Scenario: 提交异步任务并返回任务 ID

- **WHEN** Agent Core 调用 `POST /api/skills/api/async`，请求体包含 `url`、`method`、`headers`、`body`、`timeoutSeconds` 和 `asyncPoll` 配置
- **THEN** Gateway SHALL 执行初始 API 调用（同步 HTTP，含 `timeoutSeconds` 超时）
- **AND** Gateway SHALL 从初始 API 响应中按 `asyncPoll.idJsonPath` 提取外部任务 ID
- **AND** Gateway SHALL 在 `async_tasks` 表中创建一条记录，status 为 `PENDING`，包含轮询配置和初始响应
- **AND** Gateway SHALL 立即向 Agent Core 返回 `{ asyncTaskId, status: "PENDING", externalTaskId }`
- **AND** 该调用 MUST NOT 阻塞等待轮询完成

#### Scenario: Gateway 调度器自动轮询

- **WHEN** `async_tasks` 表中存在 status 为 `PENDING` 或 `POLLING` 的任务
- **AND** 距离该任务上次轮询（`last_polled_at`）已超过 `poll_interval_seconds`
- **THEN** Gateway 的轮询调度器 SHALL 选取该任务
- **AND** 调度器 SHALL 以 `poll_method`（默认 GET）和 `poll_endpoint`（`{id}` 已替换为外部任务 ID）向外部 API 发起轮询请求
- **AND** 若轮询响应中 `completion_json_path` 字段的值匹配 `completionValue`（大小写不敏感），调度器 SHALL 将 status 更新为 `COMPLETED`，记录 `poll_result` 和 `completed_at`
- **AND** 若匹配 `failedValues`（大小写不敏感），调度器 SHALL 将 status 更新为 `FAILED`，记录 `error_message`
- **AND** 若从 `started_at` 起已超过 `max_wait_seconds`，调度器 SHALL 将 status 更新为 `TIMEOUT`，记录 `error_message`
- **AND** 以上都不满足时，调度器 SHALL 将 status 更新为 `POLLING`（如当前为 PENDING），并更新 `last_polled_at`

#### Scenario: 调度器并发控制

- **WHEN** Gateway 轮询调度器单次扫描选取了 N 个待轮询任务
- **THEN** 调度器 MUST 使用固定大小的线程池（默认 20 线程）并发执行轮询
- **AND** 单次扫描选取的任务数 MUST NOT 超过可配置上限（默认 50），超出部分下次调度处理
- **AND** 调度器扫描间隔 MUST 可通过 `application.yml` 中的 `skill.async.polling.scheduler-interval-ms` 配置（默认 30000ms，即 30 秒）
- **AND** 调度器 MUST NOT 对同一任务并发发起多次轮询请求

#### Scenario: Gateway 重启后恢复轮询

- **WHEN** Skill Gateway 重启
- **AND** `async_tasks` 表中存在 status 为 `PENDING` 或 `POLLING` 的任务
- **THEN** 轮询调度器在启动后首次触发时 SHALL 扫描到这些任务并继续轮询
- **AND** 任务状态和进度 MUST NOT 因 Gateway 重启而丢失

### Requirement: Agent Core 等待异步任务结果

Agent Core 的 `executeConfiguredApiSkill` 在检测到 Skill 配置了 `asyncPoll` 时，MUST 使用异步路径：先提交任务，再阻塞等待结果。

#### Scenario: 异步任务正常完成

- **WHEN** Agent Core 向 `POST /api/skills/api/async` 提交异步任务并获得 `asyncTaskId`
- **AND** Agent Core 调用 `GET /api/skills/async-tasks/{id}/wait?timeoutMs={maxWaitMs}`
- **AND** Gateway 在 `maxWaitMs` 内检测到该任务 status 变为 `COMPLETED`
- **THEN** Gateway SHALL 返回 `{ status: "COMPLETED", result: {...} }`
- **AND** Agent Core SHALL 将 `result` 返回给 LLM
- **AND** 系统 MUST 告知 LLM 这是异步任务的最终结果（含 `asyncTaskId` 和 `externalTaskId`）

#### Scenario: 异步任务执行失败

- **WHEN** Gateway 轮询调度器将任务 status 更新为 `FAILED`
- **AND** Agent Core 正在 `GET .../wait` 上等待
- **THEN** Gateway SHALL 返回 `{ status: "FAILED", errorMessage: "..." }`
- **AND** Agent Core MUST 将失败信息返回给 LLM

#### Scenario: 等待超时（Agent Core 侧的客户端超时）

- **WHEN** Agent Core 调用 `GET /api/skills/async-tasks/{id}/wait` 时设置的 `timeoutMs` 已耗尽
- **AND** 异步任务 status 尚未到达终态
- **THEN** Gateway SHALL 返回当前状态 `{ status: "POLLING", result: null }`
- **AND** Agent Core MUST 返回结构化提示给 LLM，包含 `asyncTaskId` 和"任务仍在执行中，请稍后手动查询"的建议

#### Scenario: 初始 API 调用失败不创建异步任务

- **WHEN** Agent Core 调用 `POST /api/skills/api/async`
- **AND** Gateway 执行初始 API 调用时返回非 2xx 状态码或网络错误
- **THEN** Gateway SHALL NOT 创建 `async_task` 记录
- **AND** Gateway SHALL 直接向 Agent Core 返回错误响应
- **AND** Agent Core MUST 将该错误返回给 LLM（与同步模式错误处理一致）

### Requirement: async_tasks 数据库表

系统 MUST 新建 `async_tasks` 表用于持久化异步轮询任务的状态和配置。

#### Scenario: 表结构满足异步轮询需求

- **WHEN** 数据库执行 DDL
- **THEN** `async_tasks` 表 SHALL 包含以下字段：
  - `id`（BIGINT, PK, AUTO_INCREMENT）
  - `skill_id`（BIGINT，关联 skills 表）
  - `user_id`（VARCHAR(64)，发起用户）
  - `external_task_id`（VARCHAR(255)，上游 API 的任务 ID）
  - `poll_endpoint`（VARCHAR(1024)，已替换 `{id}` 的轮询 URL）
  - `poll_method`（VARCHAR(16)，默认 GET）
  - `poll_interval_seconds`（INT，默认 5）
  - `max_wait_seconds`（INT，最大等待秒数）
  - `completion_json_path`（VARCHAR(255)）
  - `completion_value`（VARCHAR(64)）
  - `failed_values`（TEXT，JSON 数组）
  - `result_json_path`（VARCHAR(255)）
  - `poll_headers`（TEXT，JSON）
  - `initial_response`（MEDIUMTEXT，初始 API 响应）
  - `poll_result`（MEDIUMTEXT，最终轮询结果）
  - `status`（VARCHAR(32)，枚举值 `PENDING`/`POLLING`/`COMPLETED`/`FAILED`/`TIMEOUT`）
  - `error_message`（TEXT）
  - `last_polled_at`（DATETIME）
  - `started_at`（DATETIME）
  - `completed_at`（DATETIME）
  - `created_at`（DATETIME）
  - `updated_at`（DATETIME）
- **AND** 表 SHALL 在 `status` 和 `skill_id` 列上建立索引

### Requirement: asyncPoll 配置校验

系统 SHALL 在校验 `asyncPoll` 配置的合法性。校验在 Agent Core 加载 Skill 配置时执行。

#### Scenario: asyncPoll 缺少必填字段时回退同步

- **WHEN** Skill `configuration` 中 `asyncPoll` 存在但 `pollEndpoint` 缺失或为空
- **THEN** 系统 SHALL 忽略 `asyncPoll` 配置并按同步模式执行
- **AND** 系统 MUST 记录警告日志提示配置不完整

#### Scenario: asyncPoll 轮询间隔非法时 clamp

- **WHEN** `asyncPoll.pollIntervalMs` 被设置为小于 1000 的值
- **THEN** 系统 SHALL clamp 到 1000 毫秒并记录警告日志
