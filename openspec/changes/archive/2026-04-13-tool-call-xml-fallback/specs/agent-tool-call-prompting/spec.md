# agent-tool-call-prompting Specification

## ADDED Requirements

### Requirement: 系统提示中约束标准 tool calling 与文本回退格式

Agent Core SHALL 在创建 ReAct Agent 或绑定工具时，将一段可维护的策略文本并入系统层指令（或等效全局提示），明确：在 API 支持时 MUST 使用协议提供的 **tool / function calling**（结构化 `tool_calls`），使工具名与参数出现在 API 定义的结构化字段中；仅在无法使用结构化调用时，MAY 在 assistant 正文中使用 `<tool_call>` 与 `</tool_call>` 包裹 **合法 JSON**，且该 JSON MUST 能被解析为至少包含工具名称与参数的对象（字段名在实现中固定并与前端解析器一致，例如 `name` 与 `arguments`）。

#### Scenario: 提示词包含优先结构化调用

- **WHEN** 部署包含本能力的 Agent Core 版本
- **THEN** 发往模型的系统或等价上下文中 SHALL 出现上述策略的实质要求（优先结构化 tool calling）
- **AND** SHALL 包含对 `<tool_call>` JSON 形状的约定说明

#### Scenario: 不与现有业务提示冲突

- **WHEN** 已存在记忆、Skill 或任务跟踪等其它策略文本
- **THEN** tool calling 策略 SHALL 作为追加段落或清晰分隔的节存在
- **AND** SHALL NOT 静默删除既有策略全文
