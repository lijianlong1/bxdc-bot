## ADDED Requirements

### Requirement: 任务历史载荷与后端压缩策略一致

前端客户端在构造 `POST /api/tasks` 所附带的 **对话 history**（若实现向网关传递多轮 `user`/`assistant` 消息）时，SHALL 与 `agent-history-compression` 及后端 sanitize 策略 **兼容**：可选地预先缩短或省略渐进披露大段正文，SHALL NOT 依赖「仅前端裁剪」作为唯一净化手段（服务端仍为权威）。

#### Scenario: 可选客户端裁剪

- **WHEN** 产品选择在客户端层减少 history 体积
- **THEN** 客户端 MAY 省略已知的 `REQUIRE_PARAMETERS` 大块正文
- **AND** 仍应保留用户消息与关键 tool 结果以便展示与审计（与 `useChat` 本地消息列表可分离存储的实现允许在发送请求时派生「瘦身」副本）

### Requirement: 不向用户隐藏必要消息正文

在执行可选裁剪时，客户端 SHALL NOT 因压缩而破坏聊天 UI 中用户已看到的完整线程，除非产品明确将「展示层」与「发往 Agent 的 history」分离；若分离，SHALL 仅对发往后端的副本瘦身。

#### Scenario: UI 完整、请求可瘦身

- **WHEN** 采用双副本策略（UI 完整、请求瘦身）
- **THEN** 用户在本机消息列表中仍能看到过往完整 assistant 内容（除非用户自行清除）
- **AND** 发往任务的 history 副本符合压缩 spec
