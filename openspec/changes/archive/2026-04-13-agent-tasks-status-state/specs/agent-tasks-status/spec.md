# agent-tasks-status（delta）

## ADDED Requirements

### Requirement: LangGraph State 包含 tasks_status

Agent Core 中的 LangGraph 应用 SHALL 在图 State 中定义 **`tasks_status`** 字段，用于表示会话内**独立任务**的完成状态；该字段 SHALL NOT 仅存在于消息文本中而无结构化载体。

#### Scenario: 状态可持久化

- **WHEN** 使用支持 checkpoint 的图执行配置
- **THEN** `tasks_status` SHALL 作为 State 的一部分参与序列化与恢复
- **AND** 恢复后会话 SHALL 能继续基于已记录任务状态决策

#### Scenario: 任务项可区分

- **WHEN** 存在多个独立任务
- **THEN** `tasks_status` SHALL 使用稳定键（例如任务 id）区分各任务
- **AND** 每个任务 SHALL 至少具备可判定的完成状态（含「已完成」语义）

### Requirement: 任务执行路径更新 tasks_status

在任务执行相关节点（包括但不限于工具执行成功路径）中，系统 SHALL 在**对应任务完成**时将 `tasks_status` 中该项更新为已完成（或等效终态）；SHALL NOT 在完成工作后仍长期保持「未完成」除非明确失败或取消策略。

#### Scenario: 工具成功完成后标记

- **WHEN** 某次工具调用成功结束且该次调用关联到某一任务 id
- **THEN** `tasks_status` 中该任务 id 对应项 SHALL 更新为已完成（或约定的终态）
- **AND** 后续图步骤 SHALL 能读取到该更新

### Requirement: 决策与模型提示消费 tasks_status

路由逻辑或注入到模型的系统/辅助提示中 SHALL 引用 `tasks_status`（或其摘要），以区分**已完成**与**待处理**任务；对已标记为已完成的任务，SHALL NOT 在无新用户指令时要求模型重复执行同等工作。

#### Scenario: 已完成任务不重复执行

- **WHEN** 某任务在 `tasks_status` 中已为已完成
- **THEN** 下一决策步骤 SHALL 优先引导模型处理未完成任务或响应用户新指令
- **AND** SHALL NOT 仅依赖长消息历史推断是否仍需执行该任务

#### Scenario: 提示包含任务摘要

- **WHEN** 调用 LLM 进行 ReAct 决策或最终回复
- **THEN** 输入上下文 SHALL 包含基于 `tasks_status` 的简短摘要或可机读结构
- **AND** 摘要 SHALL 明示哪些任务已完成、哪些仍待处理（若存在待处理项）
