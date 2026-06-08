## ADDED Requirements

### Requirement: Gateway 异步轮询闭环

系统 SHALL 在 `POST /api/skills/execute` 内部检测 Skill 配置中的 `asyncPoll` 字段。若存在，Gateway 内部完成"发起初始请求 → 提取 taskId → 定时轮询 → 返回最终结果"的完整闭环，Agent 无感知这是一次异步调用。

#### Scenario: 异步轮询 Skill 正常完成

- **WHEN** Skill 配置包含 `asyncPoll` 字段（含 `pollEndpoint`、`idJsonPath`、`completionJsonPath` 等）
- **AND** Agent 调用 `POST /api/skills/execute` 执行该 Skill
- **THEN** Gateway 发起初始 API 请求
- **AND** 用 `idJsonPath` 从初始响应中提取外部 taskId
- **AND** 创建 `async_tasks` 行并注册 `CompletableFuture`
- **AND** `AsyncTaskPollingScheduler` 按 `pollIntervalSeconds` 定时轮询外部 API
- **AND** 当轮询结果满足 `completionJsonPath` / `completionValue` 时，标记 COMPLETED
- **AND** Gateway 返回轮询最终结果给 Agent

#### Scenario: 异步轮询超时

- **WHEN** 轮询时间超过 `maxWaitSeconds`（默认 600 秒）仍未完成
- **THEN** Gateway 标记任务为 TIMEOUT
- **AND** 返回 `{ status: "TIMEOUT", errorMessage: "Task timed out after N seconds" }`

#### Scenario: 异步轮询失败

- **WHEN** 轮询结果匹配 `failedValues` 配置
- **AND** 或外部 API 返回错误
- **THEN** Gateway 标记任务为 FAILED
- **AND** 返回 `{ status: "FAILED", errorMessage: "..." }`

#### Scenario: 无 asyncPoll 配置的 Skill 不受影响

- **WHEN** Skill 配置中不包含 `asyncPoll` 字段
- **THEN** Gateway 走原有的同步执行路径（API/SSH/Template）
- **AND** 行为与 Phase 2 完全一致

### Requirement: 执行类型注册端点

Gateway SHALL 新增 `GET /api/system-skills/execution-types` 端点，返回所有可用的 Skill 执行类型及其配置表单 Schema，供前端动态渲染配置页。

#### Scenario: 返回所有执行类型

- **WHEN** 前端请求 `GET /api/system-skills/execution-types`
- **THEN** 返回 JSON 数组，每个元素包含 `type`、`label`、`configSchema`
- **AND** `configSchema` 的每个 property 包含 `ui` 字段指示前端渲染的控件类型

#### Scenario: 新增类型时只改此端点

- **WHEN** Gateway 新增一种执行类型（如 `database_query`）
- **THEN** 在 `execution-types` 端点追加一个新的 configSchema 对象即可
- **AND** 前端 `ConfigFormRenderer` 无需修改

### Requirement: 前端 ConfigFormRenderer 通用组件

前端 SHALL 提供 `ConfigFormRenderer.vue` 组件，根据输入的 configSchema 动态渲染配置表单控件。组件 SHALL 支持以下 `ui` 类型：`input`、`select`、`keyValue`、`jsonEditor`、`textarea`、`number`。

#### Scenario: 根据 Schema 渲染 API Skill 配置表单

- **WHEN** 用户在 Skill 管理页选择"API 调用"类型
- **THEN** 表单渲染 method（select）、endpoint（input）、headers（keyValue）、parameterContract（jsonEditor）
- **AND** 每个字段旁显示对应的 aiHint 提示

#### Scenario: 根据 Schema 渲染 SSH Skill 配置表单

- **WHEN** 用户选择"SSH 执行"类型
- **THEN** 表单渲染 command（textarea，含安全提示）
- **AND** 不渲染 API 类型的字段（method、endpoint 等）

#### Scenario: 新增类型时前端零改动

- **WHEN** Gateway 新增一种执行类型并注册其 configSchema
- **THEN** 前端加载 `execution-types` 后自动渲染对应表单
- **AND** `ConfigFormRenderer.vue` 不需要代码修改

## REMOVED Requirements

### Requirement: Agent Core 侧异步轮询

Agent Core MUST NOT 在本地执行异步轮询逻辑。`executeConfiguredApiSkillAsync`、`postPollingAudit` 函数 SHALL 被移除。

#### Scenario: Agent 不再处理 asyncPoll 配置

- **WHEN** 扩展 API Skill 的配置中包含 `asyncPoll`
- **THEN** Agent Core 不解析 `asyncPoll` 字段
- **AND** 统一将参数提交至 `POST /api/skills/execute`
- **AND** Gateway 内部完成异步轮询

### Requirement: Gateway 异步执行端点

Skill Gateway MUST NOT 继续暴露 `POST /api/skills/api/async` 和 `GET /api/skills/async-tasks/{id}/wait` 端点。对应的 Controller 方法和 SecurityConfig 放通规则 SHALL 被移除。

#### Scenario: 异步端点不可用

- **WHEN** 调用方请求 `POST /api/skills/api/async`
- **THEN** Gateway 返回 404
