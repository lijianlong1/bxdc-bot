## Context

当前确认流程依赖 LLM 行为：tool 返回 `CONFIRMATION_REQUIRED` → `preModelHook` 注入系统消息要求模型输出文字 → 模型（理论上）生成确认提问 → 用户打字回复 → 模型二次调用 tool 携带 `confirmed: true`。
实际表现：多数模型忽略系统消息，以空 content + 重复 tool_call 进入死循环；即便成功，用户需手动输入文字，且确认无法绑定到具体 tool call。

前端已有 `parseConfirmationRequest` 从 assistant markdown 中提取确认按钮，但 `CONFIRMATION_REQUIRED` 来自 **tool result**，不在 assistant content 中，因此按钮永远不渲染。

Agent-Core 使用 LangGraph `createReactAgent`，其 SSE 流通过 `agent.stream()` 返回 chunk → `agent.controller.ts` 中 `for await` 推送到 `Subject<MessageEvent>`。当前没有「暂停循环等待外部输入」的机制。

## Goals / Non-Goals

**Goals:**

1. **消除模型依赖**：确认流程 100% 由系统控制；模型永远不需要理解 `CONFIRMATION_REQUIRED` JSON 协议。
2. **按钮确认**：前端用 UI 按钮（确认 / 取消），不需要用户输入文字。
3. **单次绑定**：一次确认仅绑定到一次 tool call（`toolCallId`），不影响同一 skill 的后续调用。
4. **对话流内**：确认卡片出现在聊天消息中，用户可见上下文后再决策。

**Non-Goals:**

- 批量确认（多个 skill 一次性确认）
- 后端持久化确认记录（内存生命周期）
- 管理员跳过确认
- SSH 工具自带的 `CONFIRMATION_REQUIRED`（保持现有模型文本确认即可；或后续统一，不在本次范围）

## Decisions

### Decision 1: Tool 返回 CONFIRMATION_REQUIRED 时，agent-core 直接拦截并发送 SSE 事件

**选项 A（选定）**：在 `agent.controller.ts` 的 `for await (chunk of stream)` 循环中检测 tool message 含 `CONFIRMATION_REQUIRED`；检测到后立即发送 `confirmation_request` SSE 事件，**不再将该 chunk 透传给前端的普通消息流**；然后 **break** 出 stream 循环（不向 LLM 提供下一轮 input），等待 confirm 端点回调后恢复执行。

**选项 B（弃用）**：在 `preModelHook` 中拦截并修改 LLM 消息。问题：仍依赖 LLM 行为；无法阻止 LLM 产生空 tool_call 再进入循环。

**Rationale**：选项 A 将控制权从 LLM 转移到系统层，彻底避免循环。

### Decision 2: 使用 Promise 挂起 + 恢复机制

在 `runTask` 中维护一个 `Map<string, { resolve, reject }>` 的 pending confirmation 表。stream 循环检测到 `CONFIRMATION_REQUIRED` 后：
1. 发送 `confirmation_request` SSE 事件
2. 创建一个 `Promise` 并 `await` 它（这会暂停 `for await`）
3. `POST /agent/confirm` 端点通过 sessionId 查找 pending promise 并 resolve/reject
4. resolve 后，agent-core 重新调用同一 tool（带 `confirmed: true`）并将 tool result 注入消息后恢复 LLM 循环

**Alternative**：创建新 task 继续对话。但这会断开 SSE 连接和上下文，用户体验不佳。

**Rationale**：Promise 挂起方式最简单，保持同一 SSE 连接和 session 上下文不断裂。

### Decision 3: SSE 事件格式

```json
{
  "type": "confirmation_request",
  "sessionId": "abc-123",
  "toolCallId": "call_65a79b4678f1490fbc1f6f6e",
  "toolName": "extended_query_daily_news",
  "skillName": "query_daily_news",
  "summary": "Execute extended skill: query_daily_news",
  "details": "Skill \"query_daily_news\" requires user confirmation before execution.",
  "arguments": { "input": "娱乐" }
}
```

前端据此渲染确认卡片。

### Decision 4: 确认 REST 端点

`POST /agent/confirm` body: `{ sessionId, toolCallId, confirmed: boolean }`

- `confirmed: true` → resolve promise → 重新调用 tool 带 `confirmed: true` → 注入结果 → 恢复 stream
- `confirmed: false` → resolve promise with rejection signal → 注入 "用户已取消" tool message → 恢复 stream → LLM 收到取消信息后自然回复

### Decision 5: 前端确认卡片绑定到 toolCallId

`useChat` 维护一个 `pendingConfirmations` ref（`Map<string, ConfirmationRequest>`）。收到 `confirmation_request` SSE 事件后 set，用户点击按钮后 delete。`MessageList.vue` 根据 pending 状态渲染按钮，点击后调用 `api.ts` 的 `confirmAction(sessionId, toolCallId, confirmed)`。

### Decision 6: 清理 preModelHook 中的确认阻断逻辑

移除 `hasPendingConfirmationRequiredFromTool` 和相关系统消息注入。保留 `preModelHook` 的 tasks_status 功能。

## Risks / Trade-offs

- **[单进程限制]** → Promise 挂起假设 confirm 端点与 stream 在同一进程。当前架构为单实例部署，满足条件。水平扩展需改用外部 pub/sub（Redis 等），但这是 Non-Goal。
- **[超时]** → 用户长时间不确认会导致 SSE 连接和内存占用。Mitigation: 设置 5 分钟超时自动 reject，并在 SSE 发送 timeout 事件。
- **[并发确认]** → 同一 session 多个需确认 skill 排队执行。当前 ReAct agent 单线程，不会并发出现多个 confirmation，故无此问题。
- **[兼容性]** → `buildExtendedSkillConfirmationRequiredResponse` 中的 `instruction` 字段移除后，旧版前端不再收到模型文字提示。Mitigation: SSE 事件是新增的，旧前端不处理但也不报错。
