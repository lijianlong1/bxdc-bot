## ADDED Requirements

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
