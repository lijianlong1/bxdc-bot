## ADDED Requirements

### Requirement: 确认与会话标识一致性

前端客户端 SHALL 在调用 `POST /agent/confirm` 时使用与发起 Agent 运行（`run` / 任务上下文）**相同**的会话标识（按后端约定：`sessionId`、`thread_id` 或与任务 `id` 的映射之一）；SHALL NOT 使用与当前 SSE 订阅任务不一致的标识。

#### Scenario: 确认按钮使用当前任务会话

- **WHEN** 用户在同一任务对话中点击确认或取消
- **THEN** 请求体中的会话字段与当前任务/运行注入后端的值一致
- **AND** 后端能够匹配到待处理的确认

#### Scenario: 标识缺失或错误

- **WHEN** 客户端无法确定当前任务的会话标识
- **THEN** 客户端 SHALL 禁用确认操作或提示错误
- **AND** SHALL NOT 发送可能误绑其他会话的确认请求

### Requirement: 确认请求的用户反馈

当 `POST /agent/confirm` 返回错误（如 404 无待处理确认、409 状态冲突、网络失败）时，前端 SHALL 更新确认卡片或全局提示状态，SHALL NOT 静默失败；用户可选择重试或关闭卡片（具体文案由实现决定）。

#### Scenario: 无 pending 时可见反馈

- **WHEN** 后端返回表示无匹配 pending 的错误
- **THEN** 用户看到明确反馈（非空白）
- **AND** loading 状态结束

#### Scenario: 网络错误可重试

- **WHEN** 请求因网络中断失败
- **THEN** 客户端允许用户在合理范围内重试确认
- **AND** 不因单次失败永久卡死 thinking 状态（与现有 SSE 完成语义一致）
