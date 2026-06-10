# api-extension-skill-llm-tool-call

## Purpose

Define how extension **API** skills are presented to the LLM as tools and how the agent MUST avoid tool-call retry loops when the model mis-encodes parameters.
## Requirements
### Requirement: Tool description matches single input parameter

The system MUST present extension API skills to the LLM with documentation that is consistent with the tool schema: all parameters described in the `parameterContract` MUST appear as **top-level** fields in the tool’s structured `parameters` (from `DynamicStructuredTool` / Zod), **not** nested inside a single `input` JSON string.

#### Scenario: Description instructs structured fields

- **WHEN** an extension API skill is registered as a LangChain tool with structured parameters
- **THEN** the tool description visible to the LLM MUST list each contract field (or reference the contract) in a way consistent with the OpenAI/LangChain `parameters` schema
- **AND** the description MUST NOT state that contract fields MUST be provided only via a single stringified JSON assigned to `input`

### Requirement: Recovery from flat tool arguments

When structured tool arguments are **empty** or **missing required contract fields**, the system MUST recover parameter data if the runtime tool call arguments object contains flat keys matching the contract **or** legacy nested `input` string, by merging those values into the same normalization path used for successful API invocation.

#### Scenario: Flat args present when structured payload is empty

- **WHEN** the tool implementation receives an empty object or missing required keys after Zod parsing
- **AND** the tool runtime exposes original call arguments with contract keys at the top level, or a legacy string `input` in `args`
- **THEN** the system MUST merge those arguments into the payload used for validation and HTTP execution
- **AND** the system MUST NOT discard non-empty structured fields in favor of empty legacy data without defined precedence

### Requirement: Full disclosure without REQUIRE_PARAMETERS round-trip

The system MUST NOT rely on a `REQUIRE_PARAMETERS` (or equivalent) **second-call** progressive disclosure flow for API extension skills. The tool’s **description** and structured `parameters` MUST expose **full** contract fields and skill intent in one pass; missing or invalid parameters MUST surface as **Zod** and/or **Ajv** validation errors on the tool result, not as a dedicated “please call again with parameters” empty-handshake response.

#### Scenario: Single-call success path

- **WHEN** the LLM issues a tool call with all required structured fields valid per contract
- **THEN** the system proceeds without requiring a prior `REQUIRE_PARAMETERS` response

#### Scenario: Missing parameters

- **WHEN** required fields are missing or invalid
- **THEN** the system returns validation errors to the LLM
- **AND** MUST NOT require a separate progressive-disclosure round that only returns documentation without executing validation logic

### Requirement: 异步 API 任务必须 fire-and-forget 立即返回

When the agent invokes an extension API skill with `asyncPoll` configured (either `pollStrategy: SINGLE_CALL` or `pollStrategy: PERIODIC` / unset), the system MUST submit the task to the gateway and return control to the LLM **immediately** without waiting for the upstream task to reach a terminal state (COMPLETED / FAILED / TIMEOUT).

#### Scenario: SINGLE_CALL 模式立即返回
- **WHEN** LLM 调用带 `asyncPoll.pollStrategy = "SINGLE_CALL"` 的 API skill
- **THEN** agent-core 提交到 gateway 后**立即**返回
- **AND** 返回值 SHALL 包含 `status: "SINGLE_CALLED"` 和 note 告知"任务在后台跑、结果进通知中心"
- **AND** agent-core MUST NOT 同步调用 `/api/skills/async-tasks/{id}/wait` 阻塞 LLM

#### Scenario: PERIODIC 模式立即返回
- **WHEN** LLM 调用带 `asyncPoll.pollEndpoint` 的 API skill（即 PERIODIC 模式）
- **THEN** agent-core 提交到 gateway 后**立即**返回
- **AND** 返回值 SHALL 包含 `status: "POLLING"` 和 note 告知"任务在后台轮询、结果进通知中心"
- **AND** agent-core MUST NOT 同步调用 `/api/skills/async-tasks/{id}/wait` 阻塞 LLM

#### Scenario: 用户体验一致性
- **WHEN** 用户在前端对话窗口触发任意异步 API skill（SINGLE_CALL 或 PERIODIC）
- **THEN** LLM 响应延迟 SHALL 仅取决于 `submit → gateway` 的网络时间（亚秒级）
- **AND** 前端 SHALL NOT 出现"转圈圈等待任务完成"的卡顿
- **AND** 异步任务 SHALL 立即出现在通知中心（`/api/async-tasks/my`）

#### Scenario: 任务进度由通知中心接管
- **WHEN** 异步任务在 gateway 后台运行（PENDING → POLLING → COMPLETED/FAILED/TIMEOUT）
- **THEN** 通知中心 SHALL 实时反映状态变更（前端轮询 5s 一次）
- **AND** LLM 不再需要返回"任务结果"——结果由通知中心推送给用户

#### Scenario: 审计日志标记 fire-and-forget
- **WHEN** agent-core 提交异步任务后立即返回
- **THEN** audit log SHALL 在 `AGENT_REQUEST` 阶段记录 `fireAndForget: true`
- **AND** audit log SHALL 在 `extraJson` 字段记录 `pollStrategy`（SINGLE_CALL 或 PERIODIC）

### Requirement: AsyncTaskPollingScheduler 维护双线程池架构

后端 `AsyncTaskPollingScheduler` SHALL 维护两个独立的 ExecutorService：
- `periodicExecutor`: 固定 20 线程池，负责 PERIODIC 周期轮询任务
- `singleCallExecutor`: 缓存线程池，负责 SINGLE_CALL 单次长调用任务

#### Scenario: 按 pollStrategy 分发到对应线程池
- **WHEN** scheduler 从 `findPendingOrPollingTasks()` 拉取任务列表
- **AND** 任务的 `pollStrategy` 字段为 `SINGLE_CALL`
- **THEN** 系统 SHALL 提交任务到 `singleCallExecutor`
- **AND** 任务的 `pollStrategy` 字段为 `PERIODIC`
- **THEN** 系统 SHALL 提交任务到 `periodicExecutor`

#### Scenario: 进程关闭时正确清理线程池
- **WHEN** Spring 容器关闭（`@PreDestroy` 触发）
- **THEN** `periodicExecutor` SHALL 调用 `shutdown()`
- **AND** `singleCallExecutor` SHALL 调用 `shutdown()`
- **AND** 两个线程池 SHALL 等待已提交任务完成（`awaitTermination`）

### Requirement: agent-core asyncPoll Submit 原子保持 fire-and-forget 语义

agent-core 在调用带 `asyncPoll` 配置的 API Skill 时 SHALL：
1. 立即 submit 到 gateway `/api/skills/execute`（或直接到 async submit endpoint）
2. **不**同步等待 async 任务完成（**不**调用 `future.get()` / **不**轮询 `/api/async-tasks/{id}/wait`）
3. 立即返回 `status: "SINGLE_CALLED"` 或 `status: "POLLING"` 给 LLM

#### Scenario: SINGLE_CALL 模式 submit 立即返回
- **WHEN** LLM 调用带 `asyncPoll.pollStrategy = "SINGLE_CALL"` 的 API Skill
- **THEN** agent-core SHALL 立即返回 `status: "SINGLE_CALLED"`
- **AND** SHALL NOT 同步调用 `/api/async-tasks/{id}/wait` 阻塞 LLM

#### Scenario: PERIODIC 模式 submit 立即返回
- **WHEN** LLM 调用带 `asyncPoll.pollEndpoint` 的 API Skill（即 PERIODIC 模式）
- **THEN** agent-core SHALL 立即返回 `status: "POLLING"`
- **AND** SHALL NOT 同步调用 `/api/async-tasks/{id}/wait` 阻塞 LLM

### Requirement: SkillExecutionService.executeApiSkillAsync 不阻塞 gateway 线程

`SkillExecutionService.executeApiSkillAsync` SHALL 在 submit async 任务后立即返回，不调用 `CompletableFuture.get()` / `future.get(timeout)`。

#### Scenario: gateway 端 fire-and-forget 实现
- **WHEN** gateway 收到带 `asyncPoll` 的 API skill 执行请求
- **THEN** `executeApiSkillAsync` SHALL submit 任务到 `asyncTaskPollingService.createTask()`
- **AND** 立即返回 status map：`{status: SINGLE_CALLED | POLLING, taskId, externalTaskId, message}`
- **AND** SHALL NOT 调用 `asyncTaskPollingScheduler.registerFuture().get()`

#### Scenario: 后台轮询由 scheduler 接管
- **WHEN** async 任务被 submit 到 gateway
- **THEN** `AsyncTaskPollingScheduler.pollTasks()` SHALL 在后续 30s 周期内拉取并轮询该任务
- **AND** 任务状态变更（PENDING → POLLING → COMPLETED/FAILED/TIMEOUT）由 scheduler 写入 `async_tasks` 表
- **AND** 前端 SHALL 通过 `/api/async-tasks/my` 通知中心查询最新状态

