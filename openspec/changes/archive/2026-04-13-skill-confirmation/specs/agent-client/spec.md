## ADDED Requirements

### Requirement: 解析 confirmation_request SSE 事件

前端客户端 MUST 能从 SSE 流中识别 `type: "confirmation_request"` 事件，并将其写入确认状态而非普通消息内容。

#### Scenario: 收到 confirmation_request 事件

- **WHEN** SSE 事件数据为 JSON 且 `type` 为 `"confirmation_request"`
- **THEN** 客户端将其存入 pending confirmations 状态（以 `toolCallId` 为 key）
- **AND** 不将该事件作为 assistant 文本内容处理

#### Scenario: 收到非 confirmation_request 事件

- **WHEN** SSE 事件数据中 `type` 不为 `"confirmation_request"`
- **THEN** 客户端按原有流程处理（assistant 文本、tool_status 等）

### Requirement: 发送确认请求

前端客户端 MUST 提供 `confirmAction(sessionId, toolCallId, confirmed)` API 方法调用 `POST /agent/confirm`。

#### Scenario: 调用确认接口

- **WHEN** 用户在确认卡片上点击按钮
- **THEN** 客户端调用 `POST /agent/confirm` 携带 `{ sessionId, toolCallId, confirmed }`
- **AND** 请求成功后从 pending confirmations 中移除对应条目

#### Scenario: 确认接口失败

- **WHEN** `POST /agent/confirm` 返回错误
- **THEN** 客户端展示错误提示
- **AND** 不从 pending confirmations 中移除条目（允许重试）
