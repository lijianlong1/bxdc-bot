## Why

当前扩展类 Skill（SkillGateway `EXTENSION`）在 agent-core 中通过 `DynamicTool` 以单一字符串 `input` 暴露给 LLM，模型需在字符串内嵌套 JSON，易出现编码错误、裸别名无法解析、与 `server_lookup` 等内置 `DynamicStructuredTool` 行为不一致等问题。同时 Skill 生成器产出的配置与运行时工具形态未对齐，削弱「命令与契约存库、模型只选 Skill」的确定性。

## What Changes

- 将 `loadGatewayExtendedTools` 注册的扩展 Skill **全部改为** `DynamicStructuredTool`，用 **Zod** 描述每类 / 每个 Skill 的工具入参（API 类可按 `parameterContract` 动态生成或与 JSON Schema 同源）。
- **SSH / server-resource-status** 类扩展 Skill：结构化字段（如台账别名 `name`）与 `executeServerResourceStatusSkill` 对齐；**命令仅来自** `configuration.command`，禁止通过 tool 参数注入任意 shell。
- **API 类扩展 Skill**：工具 parameters 与 `parameterContract` 一致；保留或收敛 **Ajv** 在执行路径上对合并后 payload 的校验（与 design 定稿）。
- **OPENCLAW / template** 等其它 `CONFIG` 类型：按类型提供对应 Zod schema，替换单字符串 `input` 主路径。
- **修改 `JavaSkillGeneratorTool` / `buildGeneratedSkill`**：支持新模式所需元数据（例如 SSH 的固定入参 schema、API 的 `parameterContract` 与工具形态一致），保证生成结果可被 Structured 加载逻辑消费。
- **BREAKING**：`api-extension-skill-llm-tool-call` 中「单参数 `input` 字符串」的约定被结构化 tool 替代；需同步 agent 提示与渐进披露（`REQUIRE_PARAMETERS`）行为。

## Capabilities

### New Capabilities

- `extended-skill-structured-tools`：定义扩展 Skill 以 `DynamicStructuredTool` + Zod 注册、执行分发、确认流（`interrupt` / `resume`）与 `toolCall.args` 的序列化约定，以及与台账 / gateway 的交互边界。

### Modified Capabilities

- `api-extension-skill-llm-tool-call`：将 LLM 侧工具形态从「单 `input` 字符串」迁移为「与 `parameterContract` 对齐的结构化顶层字段」；更新 progressive disclosure 与 flat args 恢复策略的 **REQUIREMENT**。
- `built-in-skill-generation`：Skill 生成器在生成 API / SSH / template / OPENCLAW 时输出与 **Structured 运行时** 一致的配置与文档（含 SSH 入参字段约定）。
- `api-parameter-validation`：明确 Zod（工具边界）与 Ajv（JSON Schema / 合并后校验）的职责划分或单一数据源策略（以 design 为准）。

## Impact

- **代码**：`backend/agent-core/src/tools/java-skills.ts`（`loadGatewayExtendedTools`、`execute*`、`recoverDynamicToolInput` / 确认流）、`agent` 绑定工具列表与系统提示中扩展 Skill 路由说明；可能涉及 `agent.controller` 等。
- **前端**：若 Skill 管理或 Hub 展示「如何调用」需与结构化参数一致，则 `frontend` 相关文案或辅助表单（可选）。
- **测试**：`java-skills` 相关单测、扩展 Skill 集成测试需更新 tool 调用样例。
- **依赖**：沿用 `zod`；`ajv` 是否保留由 design 二选一，不强制新增重型依赖。
