## ADDED Requirements

### Requirement: Tool 调用参数合并

前端客户端 MUST 在更新单条 assistant 消息上的 Tool/Skill 调用记录时保留有效的调用参数：任一阶段收到的非空 `arguments` 在后续状态更新中不得被「未携带参数字段」的事件静默清空；从流式图 chunk 中解析出的 tool call MUST 尽可能提取并关联与 `tool_status` 一致的参数信息（在可解析的前提下）。

#### Scenario: running 带参、completed 不带参

- **WHEN** 客户端先收到包含非空 `arguments` 的 `tool_status`（running）
- **AND** 随后收到同一 `toolId` 的 `tool_status`（completed）且载荷中未包含 `arguments` 或为空占位
- **THEN** 客户端仍展示 running 阶段已记录的参数

#### Scenario: 从 chunk 解析 tool call 时补齐参数

- **WHEN** SSE 事件为 LangGraph 流式 chunk 且其中包含带参数的 tool call 结构
- **THEN** 客户端将该参数合并到对应 Tool/Skill 记录中
- **AND** 不因后续仅含状态不含参数的 chunk 而丢失已解析参数

### Requirement: 调用日志时间轴顺序

前端客户端 MUST 在「调用日志」或等效查看器中，将 Tool/Skill 状态轨迹与 LLM 结构化日志按**单次 assistant 回复内**的真实发生顺序呈现；该顺序 MUST 基于事件接收顺序或后端提供的单调可排序字段（若实现），不得将整类 Tool 条目固定渲染在全部 LLM 条目之前或之后而脱离实际时间线。

#### Scenario: Tool 与 LLM 交错展示

- **WHEN** 一次回复中依次发生「LLM 请求 → 工具调用 → LLM 再次请求」等交错事件
- **THEN** 日志查看器中条目顺序与上述先后一致
- **AND** 用户可据此理解「何时调用模型、何时调用工具」

#### Scenario: 仅存在其中一类事件

- **WHEN** 当前消息仅有 Tool 轨迹或仅有 LLM 日志
- **THEN** 客户端仍正常展示该类条目
- **AND** 不出现空白或错误的占位顺序
