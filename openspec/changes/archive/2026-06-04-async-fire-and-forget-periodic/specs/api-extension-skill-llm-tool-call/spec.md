# Spec: api-extension-skill-llm-tool-call（增量）

## ADDED Requirements

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
