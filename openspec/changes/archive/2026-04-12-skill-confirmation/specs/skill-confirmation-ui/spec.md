## ADDED Requirements

### Requirement: 对话流内确认卡片

前端 SHALL 在收到 `confirmation_request` SSE 事件后，在当前 assistant 消息区域内渲染一个确认卡片，包含操作摘要、详情，以及「确认执行」和「取消」两个按钮。

#### Scenario: 渲染确认卡片

- **WHEN** `useChat` 收到 `confirmation_request` 类型的 SSE 事件
- **THEN** 前端 MUST 在当前 assistant 消息区域内渲染确认卡片
- **AND** 卡片 MUST 显示 `summary` 和 `details`
- **AND** 卡片 MUST 包含「确认执行」和「取消」两个可交互按钮

#### Scenario: 卡片绑定到 toolCallId

- **WHEN** 确认卡片渲染时
- **THEN** 卡片 MUST 绑定到 SSE 事件中的 `toolCallId`
- **AND** 同一 `toolCallId` 的确认卡片不得重复渲染

### Requirement: 按钮触发确认 / 取消

用户点击确认卡片上的按钮后，前端 SHALL 调用 `POST /agent/confirm` 并传递对应的 `confirmed` 值，且按钮在点击后 SHALL 不可再次交互。

#### Scenario: 用户点击确认执行

- **WHEN** 用户点击「确认执行」按钮
- **THEN** 前端 MUST 调用 `POST /agent/confirm` 携带 `{ sessionId, toolCallId, confirmed: true }`
- **AND** 按钮状态变为已确认（禁用或替换为文字提示）
- **AND** 确认卡片从 pending 状态中移除

#### Scenario: 用户点击取消

- **WHEN** 用户点击「取消」按钮
- **THEN** 前端 MUST 调用 `POST /agent/confirm` 携带 `{ sessionId, toolCallId, confirmed: false }`
- **AND** 按钮状态变为已取消（禁用或替换为文字提示）

#### Scenario: SSE 连接断开后不显示按钮

- **WHEN** SSE 连接已关闭（完成或错误）
- **AND** 存在未处理的 pending confirmation
- **THEN** 前端 MUST 将未处理的确认卡片标记为过期（禁用按钮）

### Requirement: 确认状态展示

前端 SHALL 在确认卡片交互后展示操作结果状态。

#### Scenario: 确认后显示执行中

- **WHEN** 用户点击「确认执行」后 agent-core 重新执行 tool
- **THEN** 确认卡片区域 MUST 显示「执行中」状态
- **AND** tool 执行完成后按正常 tool_status 流程更新

#### Scenario: 取消后显示已取消

- **WHEN** 用户点击「取消」
- **THEN** 确认卡片 MUST 显示「已取消」状态提示
