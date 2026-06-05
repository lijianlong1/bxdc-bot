## ADDED Requirements

### Requirement: 扩展 Skill 优先于同类内置工具

当当前会话已从 SkillGateway 加载了与用户需求语义匹配、且 **`enabled=true`、类型为 EXTENSION** 的扩展 Skill 工具时，Agent SHALL **优先**通过该扩展 Skill 工具完成相应能力；SHALL NOT 在同一用户意图下优先选用并行的 **built-in** 工具（包括但不限于通用 HTTP API 调用类、`ssh_executor`、`compute`、`linux_script_executor` 等）来**替代**该扩展 Skill，除非：(a) 用户明确要求使用底层/内置工具；(b) 扩展 Skill 明显不匹配该请求；(c) 扩展 Skill 报错且内置工具为唯一可行回退（回退行为 SHALL 在日志或结果中可区分）。

#### Scenario: 存在 API 类扩展 Skill 时不绕开

- **WHEN** 用户请求某类能力（例如调用特定外部 HTTP 能力）
- **AND** 当前工具列表中已注册名称与描述匹配的扩展 Skill（`extended_*` 等）
- **THEN** Agent SHALL 调用该扩展 Skill 工具
- **AND** SHALL NOT 仅为复用记忆中的 URL/参数而改用内置 API/SSH 工具作为首选路径

#### Scenario: 用户显式要求底层工具

- **WHEN** 用户明确要求「直接用 SSH」「用内置 API 不要用扩展 Skill」等
- **THEN** Agent MAY 使用内置工具
- **AND** 不要求扩展 Skill 优先

### Requirement: 系统提示中的路由规则可见性

Agent Core SHALL 在注入的系统/任务级策略文本中包含 **清晰可读** 的「扩展 Skill 优先」规则（见 design.md 中的 `[Extended skill routing]` 类段落），使模型在单次 run 内稳定服从上述优先级；规则 SHALL 与 SkillGateway 当前为用户加载的工具列表一致（不因未加载的 Skill 而虚构工具名）。

#### Scenario: 策略与已加载工具一致

- **WHEN** `GET /api/skills` 已为当前用户注册若干 EXTENSION 工具
- **THEN** 提示中列出的能力与「不得用内置替代」的约束与该集合一致
- **AND** 未发现的扩展名不得被宣称为可用
