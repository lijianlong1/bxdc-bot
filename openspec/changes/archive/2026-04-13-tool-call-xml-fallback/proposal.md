## Why

部分大模型或网关因能力/协议限制，无法在 API 响应中返回标准的 `tool_calls`（或 `additional_kwargs.tool_calls`），而是在 `text` / `content` 中用 `<tool_call>...</tool_call>` 包裹 JSON 来描述工具调用。当前前后端主要从结构化 `toolCalls` 解析工具轨迹，导致这类响应下**工具条目不出现或参数缺失**。需要在**提示词侧**明确约束使用原生 tool calling，并在**产品侧**提供可选的 XML 片段解析，以便在弱结构化输出时仍能识别「模型打算调哪些工具」。

## What Changes

- **Agent 提示词**：在系统或绑定工具相关的说明中，明确要求模型优先使用协议内的 **tool / function calling**（结构化字段），并约定若必须文本承载时，JSON 应置于 `<tool_call></tool_call>` 内且可被解析（与第 2 点开关语义一致）。
- **前端**：增加用户可见**开关**（默认关闭）；开启后，在组装/展示本轮工具调用时，**优先或回退**从 assistant 消息的 `text` / `content` 字符串中解析 `<tool_call>...</tool_call>` 内的 JSON，提取工具名与参数，用于与现有 `tool_status` / 时间线对齐；关闭时行为与现有一致，仅从结构化 `toolCalls` 取数。
- **范围说明**：本变更以**前端展示与轨迹一致性**为主；若模型从未在服务端产生可执行 `tool_calls`，LangGraph 可能仍无法真实执行工具——该限制在 design 中说明，可选后续在 agent-core 增加同源解析以对接执行（不作为本提案必达项）。

## Capabilities

### New Capabilities

- `agent-tool-call-prompting`：约束 Agent 侧提示词引导模型使用标准 tool calling，并约定 `<tool_call>` 文本格式的最低规范（与前端解析一致）。
- `frontend-tool-call-xml-mode`：约束聊天 UI 提供 XML 回退开关，以及在开启时从文本解析工具调用的行为与优先级。

### Modified Capabilities

- `agent-client`：补充前端在「XML 回退模式」下从流式 chunk / 消息文本解析工具调用的需求，与现有基于 `toolCalls` 的场景并存。

## Impact

- **代码**：`backend/agent-core`（系统提示或 Agent 工厂处拼接的 tool 说明）；`frontend`（`useChat.ts`、`MessageList` 或设置区、新建小工具函数解析 `<tool_call>`）；可选共享常量或文档。
- **用户体验**：默认无变化；开启开关后弱模型轨迹可见性提升；错误格式需在 UI 可容忍（忽略或降级展示）。
