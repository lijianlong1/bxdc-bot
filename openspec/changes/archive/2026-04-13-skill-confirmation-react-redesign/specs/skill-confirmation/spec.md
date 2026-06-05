## MODIFIED Requirements

### Requirement: Confirmation Interruption
The system SHALL pause the execution of a skill that requires confirmation using **LangGraph-native** suspension (e.g. `interrupt()` with checkpointing), and SHALL surface the pending action to the user primarily via **`confirmation_request` SSE** and the confirmation UI—not by expecting the LLM to invent a typed confirmation protocol.

#### Scenario: Agent calls sensitive skill
- **WHEN** the Agent attempts to call a skill marked with `requiresConfirmation` without a confirmation token
- **THEN** the implementation MAY still use an internal `CONFIRMATION_REQUIRED`-style payload at the SkillGateway/tool layer as needed
- **AND** the agent-core SHALL coordinate **graph interrupt + SSE** so the user is not asked to type a confirmation string as the only supported path
- **AND** the primary user-facing approval surface SHALL be the UI driven by `confirmation_request`

### Requirement: User Confirmation UI
The system SHALL present a confirmation card with action buttons when a skill requires approval; the frontend SHALL bind actions to the identifiers emitted in **`confirmation_request`** (e.g. `toolCallId`, `sessionId` / `thread_id` per implementation). The LLM SHALL NOT be the sole channel that explains *how* to confirm.

#### Scenario: Display confirmation request
- **WHEN** the agent-core emits a `confirmation_request` SSE event
- **THEN** the frontend renders an inline confirmation card with **Confirm** and **Cancel** controls
- **AND** the card is bound to the event’s correlation identifiers
- **AND** assistant-visible text MUST NOT be required reading to complete confirmation (no “type yes to proceed” as the only path)

### Requirement: Resume Execution
The system SHALL resume skill execution **via LangGraph resume on the same `thread_id` / checkpoint** after `POST /agent/confirm`. The controller SHALL NOT treat **stream draining plus a second out-of-graph tool invocation** as the **primary** correct implementation path.

#### Scenario: User confirms action
- **WHEN** the user confirms the action in the UI
- **THEN** the frontend calls `POST /agent/confirm` with `confirmed: true` and the same session/thread identifier used for the run
- **THEN** agent-core resumes the compiled graph so the tool executes with the agreed confirmation semantics **inside the graph**
- **AND** the ReAct loop continues with a subsequent model turn as defined in `agent-confirmation-hil`

#### Scenario: User denies action
- **WHEN** the user cancels the action in the UI
- **THEN** the frontend calls `POST /agent/confirm` with `confirmed: false`
- **AND** agent-core resumes with cancellation semantics **inside the graph**
- **AND** the LLM receives a coherent cancellation outcome and responds accordingly

## ADDED Requirements

### Requirement: 废弃 HTTP-only 双次调用主路径

实现 SHALL 将「仅依赖 `agent.stream` 外层 drain + 控制器内 `invokeExtendedSkillWithConfirmed`」标记为 **非主路径** 并移除或降级为兼容层；主路径 SHALL 满足 `agent-confirmation-hil` 中的 checkpoint + interrupt + resume 要求。

#### Scenario: 代码路径单一来源

- **WHEN** 新实现完成并默认启用
- **THEN** 代码审查或文档中 SHALL 能指出唯一的确认-恢复执行链
- **AND** 不得存在两条互不协调的「首次返回 + 二次直调」作为主策略
