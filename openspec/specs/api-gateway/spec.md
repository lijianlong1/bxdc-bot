# api-gateway

## Purpose

定义 API 网关的 CORS 支持、任务事件流的转发与 Skill 状态事件格式，以及会话结束信号的发送规则。
## Requirements
### Requirement: CORS 支持

API 网关 MUST 支持前端应用程序的跨源资源共享 (CORS)。

#### Scenario: 开发环境

- **当** 请求来自 `http://localhost:5173`（Vite 开发服务器）时
- **那么** 服务器响应 `Access-Control-Allow-Origin: http://localhost:5173`
- **并且** 允许方法 `GET`、`POST`、`OPTIONS`
- **并且** 允许头信息 `Content-Type`、`Authorization`

#### Scenario: 生产环境

- **当** 请求来自配置的生产域时
- **那么** 服务器响应相应的 `Access-Control-Allow-Origin` 头信息

### Requirement:任务事件流转发

任务事件流 MUST 向前端持续输出可消费的结构化事件，除了 assistant 文本外，还要包含 Skill 调用状态信息。

#### Scenario: 转发文本事件

- **当** Agent 产生新的回复文本事件
- **那么** 任务 SSE 将文本事件发送给前端客户端

#### Scenario: 转发 Skill 状态事件

- **当** Agent 产生 Skill 调用开始、进行中、完成或失败事件
- **那么** 任务 SSE 将包含 Skill 名称与状态字段的结构化事件发送给前端客户端

### Requirement:Skill 状态字段一致性

任务事件流中的 Skill 状态事件 MUST 使用稳定的数据字段，便于前端统一解析。

#### Scenario: Skill 事件字段完整

- **当** 网关向前端发送 Skill 状态事件
- **那么** 事件中包含可识别的事件类型
- **并且** 包含 Skill 名称
- **并且** 包含当前状态值

#### Scenario: 多个 Skill 连续执行

- **当** 同一任务在一次回复中连续触发多个 Skill
- **那么** 事件流按实际执行顺序输出对应事件
- **并且** 前端可依据顺序恢复完整的调用轨迹

### Requirement:会话结束信号

任务事件流 MUST 在任务结束时发送明确的完成信号，使前端能够收敛 loading 状态。

#### Scenario: 正常结束

- **当** Agent 完成当前任务
- **那么** 网关发送完成事件
- **并且** 之后不再继续发送新的 Skill 状态或文本事件

### Requirement: 自主规划 Skill 轨迹事件

任务事件流 MUST 支持输出自主规划 skill 及其内部子工具调用的层级化轨迹事件。

#### Scenario: 输出外层 skill 与子工具事件

- **WHEN** Agent 执行一个自主规划类 skill，且该 skill 内部调用了子工具
- **THEN** 任务事件流输出外层 skill 事件
- **AND** 也输出对应的子工具轨迹事件

#### Scenario: 子工具事件可关联父级

- **WHEN** 任务事件流输出某个子工具轨迹事件
- **THEN** 事件中包含可用于关联所属外层 skill 的稳定标识
- **AND** 前端客户端可据此恢复层级结构

#### Scenario: 兼容旧版 skill 事件

- **WHEN** Agent 执行的是没有内部编排的传统 skill
- **THEN** 任务事件流仍可只输出现有单层 skill 事件
- **AND** 不要求为所有 skill 强制附加子工具层级字段

### Requirement: 结构化 LLM 日志更新暴露
任务相关接口或事件流 SHALL 向前端暴露当前对话可消费的结构化 LLM 日志更新。

#### Scenario: 输出请求日志事件
- **WHEN** 后端生成一条当前任务的 LLM 请求日志
- **THEN** 任务相关实时通道或接口向前端提供该条结构化日志
- **AND** 日志中包含当前会话的关联标识

#### Scenario: 输出响应日志事件
- **WHEN** 后端生成一条当前任务的 LLM 响应日志
- **THEN** 任务相关实时通道或接口向前端提供该条结构化日志
- **AND** 日志中包含可区分请求/响应方向的字段

### Requirement: 日志事件字段稳定
暴露给前端的结构化 LLM 日志事件 SHALL 使用稳定字段，便于客户端统一解析与展示。

#### Scenario: 日志事件字段完整
- **WHEN** 后端输出一条结构化 LLM 日志事件
- **THEN** 事件中包含事件类型、会话或任务标识、时间戳与日志 payload
- **AND** 前端可以据此恢复当前对话中的日志顺序

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

