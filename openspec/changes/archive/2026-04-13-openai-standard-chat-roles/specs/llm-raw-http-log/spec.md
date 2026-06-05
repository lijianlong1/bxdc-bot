# llm-raw-http-log Specification (delta)

## ADDED Requirements

### Requirement: 原始 HTTP 日志中的请求体 role 与实际上游请求一致

当原始 HTTP 报文记录能力启用且 agent-core 记录某次模型调用的请求体时，所记录的请求 JSON 中 `messages`（若存在）每条 `role` SHALL 与本次调用实际发送至模型服务端的 HTTP 请求体一致；系统 SHALL NOT 在记录前或记录后单独应用一套与实际上游 body 不同的 `role` 变换规则。

#### Scenario: 助手轮在日志与 wire 上均为 assistant

- **WHEN** 启用了原始 HTTP 日志且 LangChain 序列化出含 `assistant` 轮次的请求体
- **THEN** `llmOrg.log` 中该次请求体中的助手 `role` SHALL 为 `assistant`
- **AND** SHALL 与实际发出的请求体逐字段一致（在相同截断策略下）
