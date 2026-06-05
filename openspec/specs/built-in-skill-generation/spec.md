# built-in-skill-generation Specification

## Purpose
TBD - created by archiving change improve-built-in-skill-generation. Update Purpose after archive.
## Requirements
### Requirement: Generate SSH Skill
The built-in skill generator SHALL support generating `CONFIG` type skills using canonical `kind=ssh`, and SHALL encode scenario intent (such as server status inspection) via preset/profile metadata and corresponding command fields.

#### Scenario: Generate SSH skill from description
- **WHEN** the user provides a description of a script or command to run on a server
- **THEN** the generator outputs a canonical SSH configuration with `kind=ssh` and the appropriate `command`
- **AND** the generator sets the matching preset/profile for the described scenario
- **AND** the system saves this skill to the SkillGateway

### Requirement: Generate OPENCLAW Skill
The built-in skill generator SHALL support generating `OPENCLAW` type skills based on user descriptions.

#### Scenario: Generate OPENCLAW skill from description
- **WHEN** the user provides a description of a complex task requiring autonomous planning
- **THEN** the generator outputs a skill configuration with `executionMode=OPENCLAW`, a generated `systemPrompt`, and a list of `allowedTools`
- **AND** the system saves this skill to the SkillGateway

### Requirement: Generate Template CONFIG Skill

The built-in skill generator SHALL support generating `CONFIG` type skills with canonical `kind=template`, containing a single generated `prompt` string derived from the user’s description of the reusable template text.

#### Scenario: Generate template skill from description

- **WHEN** the user asks for a reusable prompt-only template or similar intent without HTTP or server command execution
- **THEN** the generator outputs `executionMode=CONFIG` with `configuration` including `"kind": "template"` and a non-empty `prompt`
- **AND** the system saves this skill to the SkillGateway

### Requirement: Multi-type Generation Tool
The system SHALL provide a unified `JavaSkillGeneratorTool` (or equivalent) that can determine the target skill type (`api`, `ssh`, `openclaw`, or `template`) from the user's intent and generate the corresponding canonical configuration.

#### Scenario: Agent selects appropriate generation type
- **WHEN** the user asks to create a skill
- **THEN** the Agent uses the `JavaSkillGeneratorTool`
- **AND** the tool correctly infers the `targetType` based on whether the task is an API call, a server command, a complex planning task, or a prompt-only template
- **AND** for CONFIG mode, generated output uses canonical kinds (`api` / `ssh` / `template`) plus preset/profile metadata where needed for `api` and `ssh`

### Requirement: 生成并保存的 Skill 归属当前登录用户
所有通过 built-in skill 生成流程保存到 SkillGateway 的数据库 Skill MUST 将 **创建者** 设为 **当前登录用户**，并 MUST 符合 `skill-visibility` 中关于默认可见性与列表过滤的约定。

#### Scenario: SSH 生成保存记录创建者
- **WHEN** 生成器输出 SSH `CONFIG` skill 并成功保存到 SkillGateway
- **THEN** 持久化记录中的创建者 MUST 为当前会话用户

#### Scenario: OPENCLAW 生成保存记录创建者
- **WHEN** 生成器输出 OPENCLAW skill 并成功保存到 SkillGateway
- **THEN** 持久化记录中的创建者 MUST 为当前会话用户

#### Scenario: Template CONFIG 生成保存记录创建者
- **WHEN** 生成器输出 template `CONFIG` skill 并成功保存到 SkillGateway
- **THEN** 持久化记录中的创建者 MUST 为当前会话用户

#### Scenario: 多类型生成工具统一归属
- **WHEN** `JavaSkillGeneratorTool`（或等价工具）将 skill 写入 SkillGateway
- **THEN** 写入记录 MUST 携带当前用户作为创建者

### Requirement: 生成结果与 DynamicStructuredTool 运行时一致

`JavaSkillGeneratorTool`（或等价）生成的扩展 Skill 配置 MUST 与 `loadGatewayExtendedTools` 中 **DynamicStructuredTool + Zod** 的加载逻辑兼容：API 类 MUST 提供完整且可被用于生成工具 schema 的 `parameterContract`（JSON Schema）；SSH 类 MUST 使用 canonical `kind`/`preset`/`command` 且**不**在配置中暗示 LLM 可通过 tool 参数覆盖 `command`；template / OPENCLAW 类 MUST 提供与对应 Zod schema 一致的字段语义（由实现定稿）。

#### Scenario: 生成 API Skill 后可注册为结构化工具

- **WHEN** 生成器成功保存一个 API 扩展 Skill
- **THEN** agent-core 加载该 Skill 时 MUST 能为其构造 Zod schema（或宽松 schema + Ajv）并完成工具注册
- **AND** MUST NOT 依赖单一 `input` 字符串作为唯一对外参数形态

#### Scenario: 生成 SSH Skill 后台账别名可结构化传入

- **WHEN** 生成器成功保存一个 SSH 扩展 Skill
- **THEN** 运行时工具 schema MUST 允许通过 `name`（或设计规定的等价字段）指定台账服务器
- **AND** `command` MUST 仅来自生成配置中的持久化字段

### Requirement: Skill 生成器 Schema 与工具描述可审计

Skill 生成器 MUST 在输出中保留或生成足够元数据，使得 **SSH/API** 类 Skill 的「LLM 可见字段」与 **Zod** / `parameterContract` 可追溯一致（例如在 `interfaceDescription` 或约定字段中说明台账别名字段名），便于排查模型填参错误。

#### Scenario: 运维可对照配置与工具定义

- **WHEN** 开发者检查某 API 扩展 Skill 的 `configuration`
- **THEN** 其 `parameterContract` MUST 能作为工具 parameters 与 Ajv 校验的共同依据（与设计决策一致）

