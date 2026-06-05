# openai-chat-message-roles Specification

## ADDED Requirements

### Requirement: Chat 请求体使用 OpenAI 标准 message role

凡由 agent-core 通过 OpenAI 兼容 Chat Completions 客户端发往模型服务的请求体中，顶层 `messages` 数组内每条消息的 `role` 字段 SHALL 仅使用 API 文档约定的标准取值（例如 `system`、`user`、`assistant`、`tool`），SHALL NOT 为兼容旧网关而将助手轮次标记为 `system`，SHALL NOT 使用非标准别名 `ai` 作为消息角色。

#### Scenario: 多轮用户与助手文本历史

- **WHEN** 客户端传入包含_prior 用户与助手回复的 `history` 且 Agent 将其与当前 user 指令一并组装为发往模型的 `messages`
- **THEN** 助手侧历史条目的 `role` SHALL 为 `assistant`
- **AND** SHALL NOT 将此类条目改写为 `system`

#### Scenario: 非标准 role 不入模

- **WHEN** 入站 `history` 某条 `role` 不是 OpenAI Chat 约定的 `user`、`assistant` 或 `system`（大小写规范化后比较）
- **THEN** 系统在组装发往模型的 `messages` 前 SHALL 丢弃该条
- **AND** SHALL NOT 为「兼容」而将其改写为其它标准 role

### Requirement: 不在 HTTP 客户端层批量改写 messages role

agent-core SHALL NOT 在通用 `fetch` 包装器中对 JSON 请求体执行将 `assistant` / `ai` 等批量改为 `system` 或其它非 OpenAI 标准角色的逻辑；OpenAI 兼容序列化 SHALL 依赖 LangChain（或同类库）的标准行为与显式组装的 message 列表。

#### Scenario: 启用原始 HTTP 日志时与 wire 一致

- **WHEN** 管理员启用 `LLM_RAW_HTTP_LOG` 且一次模型调用发出请求体
- **THEN** 该请求体中的 `messages` 角色 SHALL 与 OpenAI 规范一致
- **AND** SHALL 与未经额外 role 改写的上游 HTTP body 一致（见 `llm-raw-http-log` 能力中的日志一致性要求）
