# LLM 日志查看器

## 入口

- 聊天界面中的每条 assistant 回复都会维护独立的 LLM 日志列表。
- 当该条回复已经收到结构化日志后，消息下方会显示 `日志查看` 按钮。
- 点击后会打开弹窗，查看当前回复关联的模型请求与响应日志。

## 结构化字段

每条日志都使用统一的 `LlmLogEntry` 结构：

- `id`: 日志唯一标识。
- `sessionId`: 当前任务/对话标识，用于隔离不同会话。
- `invocationId`: 单次模型调用标识，请求与响应会共用同一个值。
- `direction`: `request` 或 `response`，明确区分送给模型的参数和模型返回内容。
- `stage`: 当前固定为 `chat_model`。
- `timestamp`: 日志产生时间。
- `summary`: 面向界面的摘要信息。
- `modelName`: 模型名称，存在时会在查看器中展示。
- `request`: 请求侧结构化 payload，当前包含消息列表与调用参数。
- `response`: 响应侧结构化 payload，当前包含 generations 与底层 llmOutput 摘要。

## 实时更新方式

- `agent-core` 在模型层通过 LangChain callback 捕获请求和响应。
- 每条结构化日志会同时：
  - 追加写入 `backend/agent-core/logs/llm.log`
  - 通过现有任务 SSE 流以 `type: "llm_log"` 的 JSON 事件推送给前端
- 前端在 `useChat` 中按当前 `sessionId` 增量接收并维护日志，不影响已有 assistant 文本流和工具状态流。

## 敏感信息处理

- 所有包含 `apiKey`、`token`、`authorization` 等字样的字段会被写成 `[redacted]`。
- 结构化 payload 会做有限深度裁剪，避免把过深对象原样暴露给前端。
- 该查看器只展示当前对话关联日志，不直接暴露其他会话或全局日志检索能力。
