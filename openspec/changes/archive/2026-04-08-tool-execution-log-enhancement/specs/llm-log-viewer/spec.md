# llm-log-viewer（delta）

## ADDED Requirements

### Requirement: Tool 调用按次数展示

在同一 assistant 回复关联的日志查看器中，系统 SHALL 将每一次独立的工具调用（由唯一的 `tool_call_id` 或后端等价标识区分）作为单独一条 Tool 日志展示，而不得仅因工具名称相同而合并为一条记录。

#### Scenario: 同一工具连续执行多次

- **WHEN** 在同一次回复流程中，模型对同一 `toolName`（例如 `compute`）发起了多次 `tool_call`，且每次具有不同的 `tool_call_id`
- **THEN** 日志查看器中 SHALL 出现与调用次数一致的 Tool 条目
- **AND** 时间轴（若存在）SHALL 为每次调用保留可区分的条目顺序

#### Scenario: 状态从 running 到 completed 仍属同一次调用

- **WHEN** 同一 `tool_call_id` 先收到 running 再收到 completed（或 failed）
- **THEN** 系统 SHALL 更新同一条 Tool 日志的状态与内容
- **AND** SHALL NOT 为同一 `tool_call_id` 创建重复的并列条目

### Requirement: Tool 日志展示执行返回内容

当工具执行完成（或失败）且存在可展示的返回正文时，日志查看器 SHALL 在对应 Tool 条目中展示该内容（与「调用参数」分区区分），并对敏感字段与过长文本按实现策略脱敏或截断。

#### Scenario: 完成态含 JSON 结果

- **WHEN** 后端在工具完成事件中携带了返回正文（例如 API 的 JSON 或错误信息）
- **THEN** 用户在展开该 Tool 日志时 SHALL 能看到「返回内容」或等价区块
- **AND** 该区块 SHALL NOT 与调用参数混在同一标题下

#### Scenario: 无返回正文

- **WHEN** 工具完成事件未携带返回正文
- **THEN** 系统 MAY 隐藏该区块或展示占位说明
- **AND** SHALL NOT 因此丢弃或合并其他 Tool 条目
