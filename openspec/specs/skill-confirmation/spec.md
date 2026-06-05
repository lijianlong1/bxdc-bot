## ADDED Requirements

### Requirement: Skill Confirmation Flag
The system SHALL support a `requiresConfirmation` flag for each skill, indicating whether user approval is needed before execution.

#### Scenario: Skill requires confirmation
- **WHEN** a skill is defined with `requiresConfirmation: true`
- **THEN** the system marks it as requiring user confirmation

### Requirement: Confirmation Interruption
The system SHALL pause the execution of a skill that requires confirmation and request approval from the user.

#### Scenario: Agent calls sensitive skill
- **WHEN** the Agent attempts to call a skill marked with `requiresConfirmation` without a confirmation token
- **THEN** the system returns a `CONFIRMATION_REQUIRED` response with a summary of the action and parameters

### Requirement: User Confirmation UI
The system SHALL present a confirmation dialog or prompt to the user when a skill requires approval.

#### Scenario: Display confirmation request
- **WHEN** the Agent receives a `CONFIRMATION_REQUIRED` response
- **THEN** the Agent outputs a confirmation request to the user, including the action summary

### Requirement: Resume Execution
The system SHALL allow the Agent to resume the skill execution after receiving user confirmation.

#### Scenario: User confirms action
- **WHEN** the user confirms the action
- **THEN** the Agent calls the skill again with the `confirmed: true` parameter, and the system executes the skill

#### Scenario: User denies action
- **WHEN** the user denies the action
- **THEN** the Agent aborts the skill execution and informs the user

### Requirement: SkillGateway 扩展 Skill 执行前校验 requiresConfirmation

当 Agent 通过动态工具执行从 SkillGateway 加载的扩展 Skill（`type=EXTENSION`）时，若该 Skill 持久化的 `requiresConfirmation` 为 `true`，系统 SHALL 在 **未收到用户确认** 的情况下不执行该 Skill 的实际逻辑（含 API、SSH、模板、OPENCLAW 等所有执行分支），并 SHALL 返回与既有约定一致的 `CONFIRMATION_REQUIRED` 响应；用户确认后 SHALL 允许再次调用并执行。

#### Scenario: 需确认时首次调用返回 CONFIRMATION_REQUIRED 且不执行

- **WHEN** Agent 调用某扩展 Skill 工具
- **AND** 该 Skill 的 `requiresConfirmation` 为 `true`
- **AND** 本次调用未携带实现所约定的有效确认标志
- **THEN** 系统 MUST 返回包含 `status: "CONFIRMATION_REQUIRED"` 的响应
- **AND** MUST NOT 执行该 Skill 的副作用

#### Scenario: 用户确认后再次调用可执行

- **WHEN** 用户已确认该次操作
- **AND** Agent 按实现约定在再次调用中携带确认标志
- **THEN** 系统 MUST 执行该 Skill 的实际逻辑
