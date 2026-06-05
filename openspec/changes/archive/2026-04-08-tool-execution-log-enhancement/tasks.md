## 1. 后端：唯一 toolId 与返回体

- [x] 1.1 审计 `extractStartedToolCalls` / `extractCompletedToolCall`：确保完成态从 ToolMessage 解析出与开始态一致的 `tool_call_id`；避免回退为裸 `toolName` 作为唯一键
- [x] 1.2 扩展 `ToolTraceEvent`（`tool-trace-context.ts`）与 `emitToolEvent`：完成态增加可选返回字段（如 `result`），内容来自 message content，经脱敏与最大长度限制
- [x] 1.3 复核 `seenToolStatuses` 去重条件，确保「不同 tool_call_id」或「同 id 的 running→completed」均不被错误吞事件

## 2. 前端：列表与时间轴

- [x] 2.1 调整 `upsertToolInvocation`：仅以相同 `toolId` 合并 running/completed；移除或收紧按 `toolName` 合并为一条的逻辑，避免多次调用被覆盖
- [x] 2.2 调整 `appendToolTimelineEntry`：每次新的工具调用均追加时间轴（以唯一 `toolId` 为准），不再因同名跳过
- [x] 2.3 更新 `ToolInvocation`（或等价类型）与 `isToolStatusEvent` 收窄类型，支持返回内容字段

## 3. UI

- [x] 3.1 在 `MessageList.vue`（或日志子组件）为 Tool 行增加「返回内容」展示区块，空值时隐藏或占位
- [x] 3.2 校验展开/折叠与 `stringifyLogPayload` 对长 JSON 的可读性

## 4. 验证

- [x] 4.1 手动回归：同一会话内连续两次 `compute`（或任意同名工具），日志条数与时间轴正确
- [x] 4.2 确认 OPENCLAW 子工具（parent/child）展示仍正常
