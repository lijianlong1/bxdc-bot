## ADDED Requirements

### Requirement: LangGraph checkpoint 与单一 thread

agent-core SHALL 为需用户确认的扩展 Skill 执行路径使用 **LangGraph checkpoint**（或项目约定的等价持久化），并为每次用户会话绑定 **单一的 `thread_id`**（可与现有 `sessionId` 或任务 ID 对齐）；`POST /agent/confirm` SHALL 使用 **同一** `thread_id` 触发 **resume**，SHALL NOT 依赖「仅 HTTP 层挂起 Promise + 无 checkpoint 的二次工具调用」作为唯一正确路径。

#### Scenario: run 与 confirm 共享 thread

- **WHEN** 用户发起一次会触发需确认扩展 Skill 的对话
- **THEN** 后端为该次执行分配或复用稳定的 `thread_id`
- **AND** 前端在调用 `POST /agent/confirm` 时传递与该次运行一致的会话标识（按实现约定字段名）
- **THEN** resume 操作作用于同一 checkpoint

#### Scenario: 无匹配 thread 时明确失败

- **WHEN** 客户端提交的 `thread_id` / `sessionId` 与后端无待处理 interrupt 不匹配
- **THEN** 后端返回可区分的错误（例如 404 或约定错误码）
- **AND** MUST NOT 静默执行任意扩展 Skill

### Requirement: 图内 interrupt 与单次副作用执行

对 `requiresConfirmation: true` 的扩展 Skill，系统 SHALL 在 **用户通过 UI 确认之前** 通过 LangGraph **`interrupt()`**（或 `@langchain/langgraph` 当前版本文档所推荐的等价 human-in-the-loop API）暂停执行；用户确认后 SHALL 通过 **Command / resume** 在同一 compiled graph 内 **恰好执行一次** 带确认标志的工具路径，SHALL NOT 以控制器内「drain 流 + 进程外再次 `invokeExtendedSkillWithConfirmed`」作为主执行路径。

#### Scenario: 确认前不执行副作用

- **WHEN** Agent 选中需确认的扩展 Skill 且用户尚未在 UI 确认
- **THEN** SkillGateway 侧定义的危险副作用（API、SSH、OPENCLAW 等）MUST NOT 执行
- **AND** 图在 interrupt 边界暂停并持久化状态

#### Scenario: 确认后仅一条执行链

- **WHEN** 用户在 UI 确认
- **THEN** 恢复后的执行 MUST 走同一 graph 的 resume 路径完成工具调用
- **AND** MUST NOT 并行维护「图内一次 + 控制器内手动再调一次」两条主路径

### Requirement: 限制 LLM 对「打字确认」的可见内容

在待确认阶段，系统 SHALL NOT 依赖大模型生成「请用户输入 是/确认/confirmed」等 **打字确认** 话术作为唯一正确交互；结构化 `CONFIRMATION_REQUIRED` 载荷 SHALL 通过 **`confirmation_request` SSE**（或等价事件）驱动前端按钮，**AND** 工具描述、系统提示与中间 ToolMessage 处理 SHALL 与「仅 UI 按钮确认」一致，避免出现 **双通道**（硬确认 + 模型劝用户打字）。

#### Scenario: SSE 驱动 UI，不依赖模型念确认步骤

- **WHEN** 需确认的扩展 Skill 被触发
- **THEN** 客户端 SHALL 能仅凭 SSE 事件渲染确认卡片
- **AND** 规范上不要求用户从 assistant 正文中解析「该如何回复以确认」才能完成确认

#### Scenario: 工具描述不与 UI 冲突

- **WHEN** Skill 元数据或动态生成的工具 description 被注入模型上下文
- **THEN** 该描述 MUST NOT 要求用户以自然语言或 JSON 字段「回复确认」作为唯一路径（若实现仍需 `confirmed` 标志，该标志 SHALL 由系统在 resume 路径注入，而非用户打字）

### Requirement: 确认后继续 ReAct 闭环

用户确认（或取消）后，系统 SHALL 恢复 LangGraph 执行，使 **至少一次** 后续 LLM 节点有机会基于 **最终** tool 结果或取消信息生成 assistant 输出；SHALL NOT 在成功执行后仅向前端推送裸 JSON 而无后续模型回合，除非产品显式将「无总结」定为默认（若如此须在 `skill-confirmation` 中单独约定）。

#### Scenario: 确认成功后有可读的 assistant 收尾

- **WHEN** 用户确认且工具执行成功
- **THEN** 用户 SHALL 在合理延迟内看到与本次调用相关的 assistant 文本或明确的状态完成信号（按现有 SSE 协议）
- **AND** thinking/流式状态 SHALL 正确结束

### Requirement: 可观测性

实现 SHALL 在日志或 tracing 中区分 **interrupt**、**resume**、**tool 成功/失败/取消**，以便排查「点了确认无反应」类问题。

#### Scenario: 排障信息充分

- **WHEN** 运维或开发者根据一次失败会话排查
- **THEN** 其能区分「未收到 confirm」「thread 不匹配」「resume 失败」与「工具执行失败」
