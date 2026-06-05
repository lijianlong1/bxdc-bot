# built-in-skill-generation（delta）

本文件为对 `openspec/specs/built-in-skill-generation/spec.md` 的变更增量；归档后合并入主 spec。

## ADDED Requirements

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
