## MODIFIED Requirements

### Requirement: Generate Linux script CONFIG Skill
The built-in skill generator SHALL support generating `CONFIG` type skills for **on-server command execution** using canonical `kind=ssh` (or `linux-script` if implementation adopts the rename) with `preset`/`operation` metadata for fixed-command scenarios, and SHALL set **`executor` to `linux_script_executor`**, the fixed `command` in configuration, and tool/schema semantics so the LLM uses **`serverName`** for **`server_lookup`** (top-5, then disambiguation if more than one candidate) and passes **`serverId` + 固定 `command`（技能内）** 至 `linux_script` / 扩展执行；Zod 字段名 **MUST** 为 `serverName` 与 `serverId` 与实现对齐，且 SHALL NOT be instructed to pass credentials.

#### Scenario: Generate Linux script skill from description
- **WHEN** the user provides a description of a script or command to run on a server
- **THEN** the generator outputs a canonical configuration whose execution path is **only** the Linux script / `linux_script_executor` flow
- **AND** the generator sets the appropriate preset/profile for the described scenario
- **AND** the system saves this skill to the SkillGateway
- **AND** the stored `executor` field MUST be `linux_script_executor` (not `ssh_executor`)

### Requirement: Multi-type Generation Tool
The system SHALL provide a unified `JavaSkillGeneratorTool` (or equivalent) that can determine the target skill type (`api`, `ssh`, `openclaw`, or `template`) from the user's intent and generate the corresponding canonical configuration.

#### Scenario: Agent selects appropriate generation type
- **WHEN** the user asks to create a skill
- **THEN** the Agent uses the `JavaSkillGeneratorTool`
- **AND** the tool correctly infers the `targetType` based on whether the task is an API call, a server command, a complex planning task, or a prompt-only template
- **AND** for CONFIG mode, generated output uses canonical kinds (`api` / `ssh` / `template`) plus preset/profile metadata where needed for `api` and `ssh`, **where `ssh` server commands map to the Linux script executor path as specified above**

### Requirement: 生成结果与 DynamicStructuredTool 运行时一致
`JavaSkillGeneratorTool`（或等价）生成的扩展 Skill 配置 MUST 与 `loadGatewayExtendedTools` 中 **DynamicStructuredTool + Zod** 的加载逻辑兼容：API 类 MUST 提供完整且可被用于生成工具 schema 的 `parameterContract`（JSON Schema）；**Linux 命令类** MUST 使用 canonical `kind`/`preset`/`command` 且**不**在配置中暗示 LLM 可通过 tool 参数覆盖 `command`；**MUST** 与 **`serverName` → `server_lookup`（得 `serverId`）→ `linux_script_executor` / 扩展执行** 之产品流程一致，生成内容中 **`executor`** MUST 为 `linux_script_executor`（**MUST NOT** 为 `ssh_executor`）。`interfaceDescription` 等元数据 MAY 显式要求 Agent 先作台账 lookup 再带 `serverId` 调执行。template / OPENCLAW 类 MUST 提供与对应 Zod schema 一致的字段语义（由实现定稿）。

#### Scenario: 生成 API Skill 后可注册为结构化工具
- **WHEN** 生成器成功保存一个 API 扩展 Skill
- **THEN** agent-core 加载该 Skill 时 MUST 能为其构造 Zod schema（或宽松 schema + Ajv）并完成工具注册
- **AND** MUST NOT 依赖单一 `input` 字符串作为唯一对外参数形态

#### Scenario: 生成「服务器命令」类 Skill 后仅走 linux_script
- **WHEN** 生成器成功保存一个 **服务器命令** 扩展 Skill
- **THEN** 运行时执行 MUST 经 Gateway `linux-script`（或等义端点）与台账解析
- **AND** 工具 schema MUST 仅允许**别名**类字段 + 可选确认标志等，不暴露 `host`/`privateKey`/`password` 为必填
- **AND** `command` MUST 仅来自生成配置中的持久化字段
- **AND** 持久化 `executor` MUST 为 `linux_script_executor`

### Requirement: 生成并保存的 Skill 归属当前登录用户
所有通过 built-in skill 生成流程保存到 SkillGateway 的数据库 Skill MUST 将 **创建者** 设为 **当前登录用户**，并 MUST 符合 `skill-visibility` 中关于默认可见性与列表过滤的约定。

#### Scenario: Linux 脚本类生成保存记录创建者
- **WHEN** 生成器输出 **Linux 脚本类** `CONFIG` skill 并成功保存到 SkillGateway
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

### Requirement: Skill 生成器 Schema 与工具描述可审计
Skill 生成器 MUST 在输出中保留或生成足够元数据，使得 **API / Linux 命令** 类 Skill 的「LLM 可见字段」与 **Zod** / `parameterContract` 可追溯一致（例如在 `interfaceDescription` 或约定字段中说明台账别名字段名），便于排查模型填参错误；对 Linux 命令类 MUST 明确 **`linux_script_executor`** 与**不得**将凭据作为 LLM 可见必填字段。

#### Scenario: 运维可对照配置与工具定义
- **WHEN** 开发者检查某 API 扩展 Skill 的 `configuration`
- **THEN** 其 `parameterContract` MUST 能作为工具 parameters 与 Ajv 校验的共同依据（与设计决策一致）

## REMOVED Requirements

### Requirement: Generate SSH Skill
**Reason**: Superseded by `Generate Linux script CONFIG Skill` so that generated server-command skills no longer target `ssh_executor` or a generic SSH tool parameter surface.

**Migration**: New generator output MUST use `linux_script_executor`; runtime flow MUST be **`serverName` → `server_lookup` (candidate `serverId`s) → `linux_script` with `serverId` + `command`** (or a documented Gateway-combined single hop); update any training/docs that referred to "Generate SSH Skill" or IP-based lookup.
