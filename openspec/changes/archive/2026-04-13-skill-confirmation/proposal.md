## Why

扩展 Skill 的 `requiresConfirmation` 标志虽然已在 agent-core 动态工具层返回 `CONFIRMATION_REQUIRED`，但 LLM 不可靠地遵循 JSON 协议 —— 模型收到 tool result 后以空 content + 重复 tool_call 进入死循环，而非生成面向用户的确认文字。即便 `preModelHook` 注入系统消息也不足以 100% 阻断，因为确认仍依赖模型自觉与用户文本交互。前端现有的 `parseConfirmationRequest` 试图从 assistant markdown 中提取确认按钮，但 `CONFIRMATION_REQUIRED` 实际在 tool result 中，导致按钮不会渲染。用户被迫手动输入「确认」，且该文本确认无法精确绑定到特定 tool call。

## What Changes

- **Agent-Core 拦截与 SSE 事件**：当 tool 返回 `CONFIRMATION_REQUIRED` 时，agent-core **不再依赖模型二次调用**；而是直接向前端推送一个新的 SSE 事件 `confirmation_request`，包含 `toolCallId`、`toolName`、`skillName`、`summary`、`details`。同时将 ReAct 循环 **挂起**（不继续给 LLM 下一轮输入），等待前端通过 REST 端点回传确认结果。
- **Agent-Core 确认端点**：新增 `POST /agent/confirm` 接口，前端发送 `{ sessionId, toolCallId, confirmed: boolean }`。若 `confirmed=true`，agent-core 对同一 tool 重新调用并携带 `confirmed: true`，将结果注入消息流并恢复 ReAct 循环；若 `confirmed=false`，注入一条「用户已拒绝」的 tool message 并恢复循环。
- **前端确认 UI**：前端监听 `confirmation_request` SSE 事件后，在对话流中渲染一个确认卡片（按钮 "确认执行" / "取消"），点击按钮调用 `/agent/confirm`。确认卡片绑定到 `toolCallId`，一次确认仅生效一次。
- **移除模型依赖确认**：去掉 `preModelHook` 中注入的 `[Human confirmation required]` 系统消息和 `buildExtendedSkillConfirmationRequiredResponse` 中要求模型二次调用的 `instruction` 字段；确认流程完全由系统控制。

## Capabilities

### New Capabilities

- `skill-confirmation-sse`: Agent-Core 侧 SSE `confirmation_request` 事件推送与 `POST /agent/confirm` 端点
- `skill-confirmation-ui`: 前端对话流内嵌确认卡片（按钮确认 / 取消），绑定到单次 tool call

### Modified Capabilities

- `skill-confirmation`: 将「Agent 输出文本请求用户确认 → 用户文字回复 → 模型二次调用」改为「系统 SSE 推送 → 前端按钮 → REST 回传 → 系统直接执行」
- `agent-client`: 前端 `useChat` 需处理新的 `confirmation_request` SSE 事件类型

## Impact

- **backend/agent-core**：`agent.controller.ts`（新增 confirm 端点、SSE 事件、runTask 挂起机制）；`tasks-state.ts`（移除 preModelHook 确认阻断逻辑）；`java-skills.ts`（简化 confirmation response，移除 instruction 字段）
- **frontend**：`useChat.ts`（处理 `confirmation_request` 事件、调用 confirm API）；`MessageList.vue`（渲染确认卡片基于 SSE 事件而非 assistant content 解析）；`api.ts`（新增 `confirmAction` 请求）
