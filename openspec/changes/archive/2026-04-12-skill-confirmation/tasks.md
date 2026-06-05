## 1. Agent-Core: Confirmation 拦截与挂起机制

- [x] 1.1 在 `agent.controller.ts` 的 `runTask` 中创建 pending confirmation Map（`Map<string, { resolve, toolCall, toolName, skillName }>`），用于跨 stream/confirm 端点通信
- [x] 1.2 在 `for await (chunk of stream)` 循环中添加 tool message 检测逻辑：解析 chunk 中 tool message，若 JSON 含 `"status": "CONFIRMATION_REQUIRED"` 则发送 `confirmation_request` SSE 事件并 await 挂起 Promise
- [x] 1.3 挂起 Promise resolve 后根据 `confirmed` 值决定：`true` → 重新调用 tool 带 `confirmed: true` 并将结果注入消息流；`false` → 注入"用户已取消"tool message；两者均恢复 ReAct 循环
- [x] 1.4 添加 5 分钟超时自动取消逻辑（reject/resolve with cancel）

## 2. Agent-Core: 确认 REST 端点

- [x] 2.1 新增 `POST /agent/confirm` 端点，接收 `{ sessionId, toolCallId, confirmed: boolean }`
- [x] 2.2 在端点中查找 pending confirmation Map 并 resolve 对应 Promise；sessionId/toolCallId 不匹配时返回 404

## 3. Agent-Core: 清理旧确认逻辑

- [x] 3.1 移除 `tasks-state.ts` 中 `hasPendingConfirmationRequiredFromTool` 函数及 `preModelHook` 中注入 `[Human confirmation required]` 系统消息的逻辑
- [x] 3.2 移除 `java-skills.ts` 中 `buildExtendedSkillConfirmationRequiredResponse` 返回的 `instruction` 字段（保留 `status`、`summary`、`details` 供 agent-core 拦截层提取）

## 4. Frontend: SSE 事件处理

- [x] 4.1 在 `useChat.ts` 中添加 `isConfirmationRequestEvent` 判断函数和 `pendingConfirmations` ref（`Map<string, ConfirmationRequest>`）
- [x] 4.2 在 `eventSource.onmessage` 中识别 `type: "confirmation_request"` 事件，存入 `pendingConfirmations` 并关联到当前 assistant 消息
- [x] 4.3 在 `api.ts` 中新增 `confirmAction(sessionId, toolCallId, confirmed)` 方法调用 `POST /agent/confirm`

## 5. Frontend: 确认卡片 UI

- [x] 5.1 在 `MessageList.vue` 中基于 `pendingConfirmations` 渲染确认卡片（显示 summary、details、参数，按钮"确认执行" / "取消"）
- [x] 5.2 按钮点击后调用 `confirmAction`，更新卡片状态（已确认 / 已取消 / 执行中），禁用按钮防止重复点击
- [x] 5.3 移除旧的 `parseConfirmationRequest`（从 assistant markdown 提取）和对应的 `handleConfirm`（发送文字消息）

## 6. 验证

- [ ] 6.1 手动测试：创建 `requiresConfirmation=true` 的 skill → 调用 → 确认卡片出现 → 点击确认 → skill 执行成功
- [ ] 6.2 手动测试：点击取消 → agent 回复"已取消"→ 不执行 skill
- [ ] 6.3 手动测试：不点击按钮等待 5 分钟 → 自动取消
