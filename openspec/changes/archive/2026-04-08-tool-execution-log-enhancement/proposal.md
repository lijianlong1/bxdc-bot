## Why

当前「日志查看」中与 Tool 相关的展示存在两类问题：（1）同一会话内同一工具多次执行时，前端往往只保留一条 Tool 记录或时间轴只记一次，无法按**每次调用**区分；（2）日志中能看到调用参数，但**缺少工具执行完成后的返回内容**（如 JSON 结果、错误摘要），不利于排障与审计。

## What Changes

- **后端（agent-core）**：保证每次工具调用在 SSE `tool_status` 事件中使用**稳定且唯一**的 `toolId`（优先 LangChain / OpenAI 的 `tool_call_id`），并在完成态事件中附带**经脱敏与长度限制**的返回内容字段；复核 `emitToolEvent` 与 `seenToolStatuses` 逻辑，避免合法的多轮「同工具名」调用被错误去重或吞掉事件。
- **前端**：`upsertToolInvocation` / `logTimeline` 以「每次调用」为粒度展示（不再仅按 `toolName` 或不稳定 id 合并为一条）；`ToolInvocation` 类型与日志弹窗 UI 增加「返回结果 / 输出」区块，与「调用参数」并列展示。
- **协议**：扩展 `ToolTraceEvent`（或等价 SSE payload）文档化新增字段；敏感字段沿用现有 `[redacted]` 策略。

## Capabilities

### New Capabilities

- （无）行为作为现有「LLM / Tool 日志查看」能力的增强交付。

### Modified Capabilities

- `llm-log-viewer`：同一条 assistant 回复内，Tool 日志按**调用次数**逐条展示；每条 Tool 日志在适用时包含**执行返回内容**（与请求参数区分）。

## Impact

- **代码**：`backend/agent-core`（`agent.controller` 工具事件提取与发射、`tool-trace-context` 类型）、`frontend`（`useChat.ts`、`MessageList.vue` 或日志子组件、类型定义）。
- **兼容**：旧客户端忽略新字段仍可工作；新客户端依赖新字段时需与后端同步发布。
- **安全**：返回体可能含用户数据，须与 `sanitizeToolTraceArguments` 同级的脱敏与截断策略。
