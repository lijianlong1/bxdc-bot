# llm-gateway-message-roles

## Purpose

定义 agent-core 向大模型网关（OpenAI 兼容 HTTP API）发送对话请求时，消息角色字段的兼容性要求，确保网关不接受的 `assistant` 角色不会出现在实际 HTTP 请求体中。

## ADDED Requirements

### Requirement: 外发 chat 消息不得使用 assistant 角色

agent-core SHALL 保证：凡通过主 Agent 所使用的 OpenAI 兼容客户端发往模型服务的、包含 `messages` 数组的 chat/completions 类请求体中，任何消息的 `role` 字段 SHALL NOT 为 `assistant`（语义上表示模型历史轮次的角色 SHALL 使用 `ai`）。

#### Scenario: 多轮对话请求

- **WHEN** agent-core 向模型服务发送包含历史用户与模型轮次的 chat 请求
- **THEN** 请求 JSON 中 `messages` 内表示模型回复的条目 SHALL 使用 `role` 为 `ai`
- **AND** SHALL NOT 出现 `role` 为 `assistant` 的消息条目

#### Scenario: 原始 HTTP 日志与真实请求一致

- **WHEN** 管理员启用原始 HTTP 报文落盘且一次模型调用被记录
- **THEN** 所记录请求体中 `messages` 的角色取值 SHALL 与实际发往上游的报文一致
- **AND** 该记录中 SHALL NOT 含 `role` 为 `assistant` 的消息（若该次调用包含模型历史轮次）

### Requirement: 历史入站别名归一

对于进入 Agent 流水线的会话历史（例如 HTTP API 传入的 `history`），若条目角色为已知别名（如历史数据中出现的 `assistank` 或与 `assistant` 等价的拼写），在组装进发往模型的 `messages` 之前 SHALL 归一为 `ai`。

#### Scenario: 客户端传入 assistant 历史

- **WHEN** 客户端在 history 中为模型轮次使用 `assistant` 角色
- **THEN** agent-core SHALL 在构造模型请求前将其规范为 `ai`
- **AND** 最终 HTTP 请求体 SHALL NOT 包含 `assistant` 作为消息 `role`
