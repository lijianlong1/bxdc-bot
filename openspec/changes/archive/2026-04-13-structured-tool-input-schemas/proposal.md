## Why

内置 Agent 工具里，`compute` 已改为通过 **Zod + `DynamicStructuredTool`** 向大模型暴露 **多字段、带枚举与描述** 的 JSON Schema，调用质量明显提升。其余多数工具仍使用 LangChain 默认的 **单字符串 `input`**，模型必须在字符串内再嵌一层 JSON，易出现转义、换行、类型错误；`skill_generator` 同样依赖 `parseToolInput` 解析整段 JSON，字段多、分支多（api/ssh/openclaw/template）时问题更突出。现在应在不破坏网关契约的前提下，把同一套「结构化入参」模式推广到其它内置工具与技能生成工具。

## What Changes

- 为 **存量内置工具**（`ssh_executor`、`api_caller`、`linux_script_executor`、`server_lookup` 等当前继承 `Tool` 且单 `input` 字符串的实现）逐步迁移为 **`DynamicStructuredTool` + Zod schema**，使 OpenAI/兼容接口的 function parameters 与网关请求体字段一一对应（或经明确映射）。
- 为 **`skill_generator`** 定义 **Zod 结构化 schema**（建议按 `targetType` 使用 `z.discriminatedUnion` 或分步 refine），在调用前做校验，减少不完整 JSON 与字段错位。
- 保留现有 **Gateway HTTP 契约**（POST body 形状不变）；仅在 Agent 侧改变「模型 → 工具」这一层的参数形态。
- **BREAKING（对模型侧）**：工具 function schema 从 `{"input": "string"}` 变为多属性 object；已缓存的旧 prompt/评测脚本若硬编码旧形态需更新。对终端用户 HTTP API **无**路径或 body 合同变更。

## Capabilities

### New Capabilities

- `agent-structured-tool-input`: 约定 Agent Core 内置工具与 `skill_generator` 向模型暴露结构化入参（Zod/JSON Schema）、并在实现层与网关请求映射一致。

### Modified Capabilities

- （无）本变更主要是 Agent Core 工具绑定形态与校验策略；若未来需在 `agent-client` 规格中显式描述「工具列表的 JSON Schema 形状」，可在实现后另开 delta。

## Impact

- **代码**：`backend/agent-core/src/tools/java-skills.ts`（各类 `Java*Tool`、`JavaSkillGeneratorTool`）、可能抽取 `tool-schemas/` 或同级模块存放 Zod 定义；`AgentFactory` / 工具注册处确保仍返回 `StructuredTool` 兼容类型。
- **依赖**：已使用 `zod`；无新版本强制要求。
- **测试/观测**：LLM 日志与 `tool_status` 中的 `arguments` 将从「字符串化 JSON」变为结构化对象（序列化展示），需知会排障习惯。
- **扩展技能**：网关注册的 extension 技能仍可能使用 `DynamicTool` + 远端 schema；本提案优先 **内置工具 + skill_generator**，不与 extension 的渐进式披露逻辑冲突。
