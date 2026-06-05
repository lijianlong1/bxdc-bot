## ADDED Requirements

### Requirement: 双语 Agent 角色与职责提示

agent-core SHALL 在 `SystemPrompts` 中提供 `agentRolePrompt` 字符串，用于描述 Agent 的平台定位、核心职责（通过工具与 Skill Gateway 扩展技能协助用户完成任务），以及高层行为期望（如诚实说明能力边界、优先使用已注册扩展能力等）。`AGENT_PROMPTS_LANGUAGE` 为 `zh` 时 `agentRolePrompt` MUST 为中文；为 `en` 或无效回退时 MUST 为英文；两套文案语义须对齐。

#### Scenario: 中文环境加载角色提示

- **WHEN** 进程环境变量 `AGENT_PROMPTS_LANGUAGE` 为 `zh`
- **THEN** `Prompts.agentRolePrompt` 返回中文角色与职责说明文本

#### Scenario: 英文环境加载角色提示

- **WHEN** `AGENT_PROMPTS_LANGUAGE` 为 `en` 或未设置或无效
- **THEN** `Prompts.agentRolePrompt` 返回英文角色与职责说明文本

### Requirement: 静态策略由 system 承载

在主任务入口（`runTask` 拼装发往 LangGraph 的初始 `messages`）中，agent-core SHALL 将 `agentRolePrompt` 与既有四条策略（技能生成、扩展技能路由、任务跟踪、确认 UI）组合为**一段或多段中至少包含一条** `role: "system"` 的消息内容；上述静态片段 MUST NOT 仅出现在同轮次的 user 正文中作为唯一承载方式（即与变更前「全部挤在单条 user」相比，静态层须可通过 system 被模型消费）。

#### Scenario: 当轮请求包含 system 静态层

- **WHEN** 客户端调用 `POST .../run` 且成功构造 Agent 输入消息列表
- **THEN** 消息列表中存在至少一条 `role` 为 `system` 的消息，且其内容包含 `agentRolePrompt` 与四条策略全文

### Requirement: 动态上下文保留在 user 侧

同一次 `run` 中，由 `buildSkillPromptContext()` 产生的技能上下文、记忆检索产生的 `memoryContext`、以及 `User Instruction:` 标签与用户本次 `instruction` SHALL 作为**非 system** 消息内容发送（典型为单条 `user` 消息或项目既有等价结构），且 MUST NOT 要求将上述动态片段复制进 `agentRolePrompt` 字段。

#### Scenario: 用户指令与技能上下文不进角色常量

- **WHEN** 用户发送包含具体指令文本的请求
- **THEN** 该指令正文出现在 user 侧消息中，且不依赖实现将同一段文字硬编码进 `Prompts.agentRolePrompt`

### Requirement: 与任务状态 SystemMessage 可共存

当 `preModelHook` 因 `manage_tasks` 状态生成任务摘要并注入 `SystemMessage` 时，agent-core SHALL 不因本变更引入的静态 system 提示而破坏任务状态注入逻辑；在存在任务摘要时，LLM 输入 MAY 同时包含任务摘要与静态角色/策略 system 消息（具体条数与顺序以实现为准，但须可观测、可回归）。

#### Scenario: 存在任务状态时可运行

- **WHEN** 会话消息历史中包含未完成的 `manage_tasks` 相关状态且 `preModelHook` 注入任务摘要
- **THEN** Agent 仍可正常进入模型调用且不抛出因消息角色构造导致的异常
