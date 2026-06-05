## 1. 前端：参数合并与 chunk 解析

- [x] 1.1 在 `useChat.ts` 中调整 `upsertToolInvocation` / `upsertChildToolInvocation`，仅在新的 `arguments !== undefined` 时覆盖，否则保留已有参数
- [x] 1.2 扩展 `extractToolInvocationsFromChunk`，从 tool call 解析 `arguments` 并在调用 `upsertToolInvocation` 时传入
- [x] 1.3 核对 `isToolStatusEvent` 路径下无其它覆盖逻辑会清空 `arguments`

## 2. 前端：日志时间轴

- [x] 2.1 在 `useChat` 为当前 assistant 消息维护追加式时间轴状态（与 `tool_status` / LLM 日志事件绑定），按事件到达顺序记录条目类型与关联 id
- [x] 2.2 更新 `MessageList.vue` 日志弹窗：按时间轴数组渲染，从 `toolInvocations` 与 `llmLogs` 解析各自行内容
- [x] 2.3 调整「展开全部 / 收起全部」与时间戳展示，使其与时间轴条目一致

## 3. 后端（agent-core，按需）

- [x] 3.1 检查 `AgentController` 中 `emitToolEvent`：completed/failed 事件是否在缺失 `arguments` 时仍带上 running 阶段已发出的参数
- [x] 3.2 若完成态取自 tool message 且无参，则显式合并 `seenToolStatuses` 中已缓存的参数再下发

## 4. 验证

- [ ] 4.1 手工走一轮含扩展 Skill + 多段 LLM 的对话，确认日志弹窗顺序与调用顺序一致且参数非空
- [x] 4.2 如有现有前端测试，补充或更新与 `useChat` 合并逻辑相关的用例
