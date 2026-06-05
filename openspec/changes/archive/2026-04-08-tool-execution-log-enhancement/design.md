## Context

- 前端 `useChat` 通过 SSE `tool_status` 更新 `toolInvocations` 与 `logTimeline`；`MessageList` 日志弹窗按时间轴交错展示 Tool 与 LLM。
- `upsertToolInvocation` 以 `toolId`（及一定条件下的 `toolName` 别名）为主键合并条目；`appendToolTimelineEntry` 对同一 `toolId` 只追加一次时间轴。
- 后端 `agent.controller` 从 LangGraph chunk 解析 tool 开始/结束；`emitToolEvent` 使用 `seenToolStatuses` 在「相同 `toolId` + 相同 `status`」时跳过发送；`extractCompletedToolCall` 在缺少 id 时回退到 `toolName`，易导致多次调用共用同一 `toolId`。
- `ToolTraceEvent` 当前含 `arguments`、`summary` 等，**不含**工具函数返回的正文，UI 仅渲染「调用参数」区块。

## Goals / Non-Goals

**Goals:**

- 同一条 assistant 回复内，工具每执行一次，日志查看器中呈现**独立一条** Tool 记录（或可清晰区分的子条目），并与时间轴顺序一致。
- 完成态 Tool 日志中展示**返回内容**（字符串化 JSON 或文本），与参数分区展示；大字段与敏感信息脱敏/截断。
- 后端事件与前端状态均以 **`tool_call_id` 级唯一性**为主；无 id 时采用明确的后备策略（如 chunk 内序号），**禁止**仅用裸 `toolName` 作为多轮调用的唯一键。

**Non-Goals:**

- 不改变聊天主列表中 Tool 状态卡片的整体产品形态（除非实现时发现强耦合必须小改）。
- 不在本变更中重做全链路分布式 Trace ID 或持久化审计库。

## Decisions

1. **唯一标识**  
   - **决策**：`tool_status.toolId` 必须以模型下发的 `tool_call_id` 为首选；解析 ToolMessage 完成事件时同步使用同一 id。  
   - **备选**：纯递增 `invokeSeq`——需前后端同时改造，复杂度高。

2. **返回内容字段**  
   - **决策**：在 `ToolTraceEvent` 增加可选字段（如 `result` 或 `output`），内容来自 ToolMessage 的 `content`（或 LangChain 等价字段），经与 `sanitizeToolTraceArguments` 类似的规则脱敏，并设最大字符数。  
   - **理由**：与现有 SSE 形状一致，前端改动面小。

3. **emit 去重逻辑**  
   - **决策**：复核 `seenToolStatuses`：避免误伤「多轮同工具名、不同 `tool_call_id`」；若仍存在「同 id 连续两次 completed」的合法情况，改为比较 `(toolId, status, invocationGeneration)` 或移除对 completed 的重复抑制（优先依赖唯一 id）。具体以代码审阅为准。

4. **前端合并策略**  
   - **决策**：`upsert` 仅更新**相同 `toolId`** 的 running→completed 状态迁移；不同 `toolId` 一律**新增**条目。`logTimeline` 对每次新 `toolId`（或每次 running 事件）追加，不再按 `toolName` 去重。  
   - **备选**：列表改为一维 `invocationLog[]`——改动大，暂缓。

## Risks / Trade-offs

- **大返回体** → 截断 + 折叠 UI；必要时仅展示摘要。  
- **敏感数据** → 脱敏漏网 → 复用关键字规则并文档提示风险。

## Migration Plan

- 前后端同时发布；旧前端忽略新字段。  
- 回归：单工具单次、单工具多次、父子 Skill（OPENCLAW）嵌套。

## Open Questions

- 部分模型/适配层是否在 ToolMessage 上省略 `tool_call_id`——需在联调中确认并加固解析。
