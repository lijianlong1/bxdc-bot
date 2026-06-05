## ADDED Requirements

### Requirement: CONFIRMATION_REQUIRED 拦截与 SSE 推送

Agent-Core 在 `runTask` stream 循环中检测到 tool message 包含 `status: "CONFIRMATION_REQUIRED"` 时，SHALL 立即向前端推送 `confirmation_request` SSE 事件，并 SHALL 暂停 ReAct 循环（不向 LLM 发送下一轮输入），直到收到确认回调。

#### Scenario: tool 返回 CONFIRMATION_REQUIRED 时发送 SSE 事件

- **WHEN** agent stream 中出现一条 tool message 且其 JSON 内容包含 `"status": "CONFIRMATION_REQUIRED"`
- **THEN** agent-core MUST 发送一条 `confirmation_request` 类型的 SSE 事件，包含 `sessionId`、`toolCallId`、`toolName`、`skillName`、`summary`、`details`、`arguments`
- **AND** MUST 暂停 stream 循环，不向 LLM 发送该 tool result 作为下一轮输入

#### Scenario: 非 CONFIRMATION_REQUIRED 的 tool result 正常透传

- **WHEN** agent stream 中出现 tool message 但不包含 `"status": "CONFIRMATION_REQUIRED"`
- **THEN** agent-core MUST 按原流程将 chunk 透传至 SSE 流并继续 ReAct 循环

### Requirement: 确认 REST 端点

Agent-Core SHALL 提供 `POST /agent/confirm` 端点，接收 `{ sessionId, toolCallId, confirmed: boolean }` 请求体，用于恢复因 `CONFIRMATION_REQUIRED` 挂起的 ReAct 循环。

#### Scenario: 用户确认执行

- **WHEN** 前端发送 `POST /agent/confirm` 且 `confirmed` 为 `true`
- **AND** 存在与 `sessionId` 和 `toolCallId` 匹配的挂起 confirmation
- **THEN** agent-core MUST 重新调用同一 tool 并携带 `confirmed: true`
- **AND** 将 tool 执行结果注入消息流
- **AND** 恢复 ReAct 循环

#### Scenario: 用户取消执行

- **WHEN** 前端发送 `POST /agent/confirm` 且 `confirmed` 为 `false`
- **THEN** agent-core MUST 注入一条表示「用户已取消该操作」的 tool message
- **AND** 恢复 ReAct 循环（LLM 将据此生成回复）

#### Scenario: 超时自动取消

- **WHEN** 挂起 confirmation 超过 5 分钟未收到回调
- **THEN** agent-core MUST 自动执行取消逻辑（等同 `confirmed: false`）
- **AND** 向 SSE 发送超时提示事件

#### Scenario: sessionId 或 toolCallId 不匹配

- **WHEN** `POST /agent/confirm` 中的 sessionId 或 toolCallId 无对应挂起项
- **THEN** 端点 MUST 返回 404 或等效错误响应

### Requirement: 清理 preModelHook 确认阻断逻辑

Agent-Core SHALL 移除 `preModelHook` 中基于 `hasPendingConfirmationRequiredFromTool` 注入系统消息的逻辑，因为确认不再依赖 LLM 行为。

#### Scenario: preModelHook 不再注入确认系统消息

- **WHEN** preModelHook 执行时
- **THEN** MUST NOT 注入任何与 `CONFIRMATION_REQUIRED` 相关的系统消息
- **AND** tasks_status 摘要注入功能保持不变
