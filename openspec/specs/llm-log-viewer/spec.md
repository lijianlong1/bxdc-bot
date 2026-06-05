# llm-log-viewer Specification

## Purpose
TBD - created by archiving change add-llm-log-viewer. Update Purpose after archive.
## Requirements
### Requirement: 当前对话的结构化 LLM 日志
系统 SHALL 为当前对话中的大模型调用生成结构化日志，并明确区分请求侧与响应侧内容。

#### Scenario: 记录发送给大模型的请求
- **WHEN** 系统向大模型发起一次调用
- **THEN** 生成一条属于当前对话/任务的结构化请求日志
- **AND** 该日志明确包含送给大模型的参数信息

#### Scenario: 记录大模型返回内容
- **WHEN** 系统收到一次大模型响应
- **THEN** 生成一条属于同一对话/任务的结构化响应日志
- **AND** 该日志明确包含大模型返回的内容

### Requirement: 请求与响应字段区分
结构化 LLM 日志 SHALL 对请求侧参数和响应侧内容使用稳定且可区分的字段模型。

#### Scenario: 请求侧字段清晰
- **WHEN** 用户查看一条请求日志
- **THEN** 可以识别模型名、消息内容或其他送给大模型的关键参数
- **AND** 这些字段不会与响应内容混在同一展示区块中

#### Scenario: 响应侧字段清晰
- **WHEN** 用户查看一条响应日志
- **THEN** 可以识别大模型返回的文本、结构化响应或 tool call 相关内容
- **AND** 这些字段不会被误标为请求参数

### Requirement: 实时更新当前对话日志
系统 SHALL 在当前对话进行过程中实时更新结构化 LLM 日志，而不是只在对话结束后写入最终结果。

#### Scenario: 对话进行中追加日志
- **WHEN** 当前对话中新产生新的 LLM 请求或响应
- **THEN** 当前对话关联的日志列表实时追加或更新对应条目
- **AND** 用户无需刷新页面即可看到变化

#### Scenario: 多轮对话隔离
- **WHEN** 系统存在不同对话或任务的日志
- **THEN** 当前查看器只展示当前对话关联的日志
- **AND** 不混入其他会话的日志条目

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

