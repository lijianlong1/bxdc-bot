## ADDED Requirements

### Requirement: 用户 LLM 设置 REST 接口

API 网关 MUST 提供已认证用户读写自身 LLM 连接设置的 HTTP 接口，包括保存与更新兼容 OpenAI 的 base URL、模型名与 API Key。

#### Scenario: 保存设置成功

- **WHEN** 已认证用户提交有效的 LLM 设置负载
- **THEN** 服务器持久化该用户的配置
- **AND** 响应不包含完整 API Key 明文

#### Scenario: 未认证请求被拒绝

- **WHEN** 请求缺少有效认证
- **THEN** 服务器拒绝访问用户 LLM 设置接口

### Requirement: 任务上下文传递用户 LLM 配置

任务创建或转发至 `agent-core` 的路径 MUST 携带足够信息，使 Agent 能解析当前用户的 LLM 覆盖配置（例如通过受信服务端根据 `userId` 注入，或经鉴权的内部查询）；不得依赖前端在每次任务中明文传递 API Key。

#### Scenario: 已登录用户发起聊天任务

- **WHEN** 已登录用户创建聊天任务
- **THEN** 下游 Agent 执行可使用该用户的 LLM 设置（若已配置）
- **AND** API Key 不在浏览器与公开日志中暴露
