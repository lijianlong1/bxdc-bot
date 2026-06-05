# extended-skill-structured-tools

## Purpose

定义 SkillGateway 扩展类 Skill 在 agent-core 中以 `DynamicStructuredTool` 暴露、以 Zod 约束工具入参、并按 `kind` 分发至既有执行路径的行为。

## ADDED Requirements

### Requirement: 扩展 Skill 以 DynamicStructuredTool 注册

系统 SHALL 对已从 SkillGateway 加载且启用的每个 `EXTENSION` Skill 注册为 **`DynamicStructuredTool`**（或 LangChain 等价物），**不得**再使用仅含单一字符串 `input` 的 `DynamicTool` 作为扩展 Skill 的默认注册方式。

#### Scenario: 注册后具备结构化 parameters

- **WHEN** agent 加载扩展 Skill 列表并完成工具绑定
- **THEN** 每个扩展 Skill 对应工具的 **function parameters** MUST 包含与契约一致的具名字段（非单一 `input` 信封字符串）
- **AND** LLM 可通过顶层字段传递参数

### Requirement: Zod 作为工具入参 schema 来源

系统 MUST 为每个扩展 Skill 在注册时提供 **Zod** schema，用于生成工具参数定义并解析/校验工具调用；**API** 类 Skill 的 Zod MUST 与 `parameterContract`（JSON Schema）**语义一致**（通过动态生成或设计文档规定的同源策略）；**SSH**（`server-resource-status` + `kind=ssh`）类 SKILL MUST 使用固定 Zod schema（至少包含台账别名 `name` 或 `serverName` 之一，与 `executeServerResourceStatusSkill` 对齐）。

#### Scenario: SSH 扩展 Skill 仅暴露台账与执行元数据

- **WHEN** 注册一个 SSH 类扩展 Skill
- **THEN** 工具 schema MUST NOT 将 `command` 作为可由 LLM 填写的字段
- **AND** 远程命令 MUST 仅来自持久化 `configuration.command`

### Requirement: SSH 执行路径接受结构化参数且无裸字符串 JSON.parse

`executeServerResourceStatusSkill`（或替代实现）MUST 接受来自 StructuredTool 的**对象化**参数（或等价的稳定序列化结果），**不得**对未加引号的纯别名字符串执行 `JSON.parse` 作为唯一解析路径；MUST 支持通过 `name` / `serverName` 与当前用户 `X-User-Id` 调用 server-lookup 解析 `host`。

#### Scenario: 传入台账别名 demo

- **WHEN** LLM 调用工具且参数为 `{ "name": "demo" }`（或与 schema 一致的字段名）
- **THEN** 系统 MUST 成功解析并解析出 `host`（在台账存在且用户有权限时）
- **AND** MUST NOT 返回因 `JSON.parse("demo")` 导致的语法错误

### Requirement: 扩展 Skill 确认流与结构化参数兼容

当 `requiresConfirmation` 为 true 时，**interrupt** / **resume** 路径 MUST 保留并恢复结构化工具参数，使确认后再次执行与首次调用参数一致。

#### Scenario: 用户确认后继续执行

- **WHEN** 用户在前端确认扩展 Skill 执行
- **THEN** 系统 MUST 使用与首次 tool call 等价的参数调用同一执行逻辑
- **AND** MUST NOT 因参数从字符串改为对象而丢失字段

### Requirement: API 扩展 Skill 执行路径保持 JSON Schema 校验

对 **API** 扩展 Skill，在执行 HTTP 请求前，系统 MUST 继续依据 `parameterContract` 使用 **Ajv**（或与本变更 design 中「单一真理源」策略等价的校验）对合并后的 payload 进行校验；Zod 与 Ajv 的职责划分 MUST 与 `api-parameter-validation` delta 一致。

#### Scenario: 工具边界与业务校验均通过

- **WHEN** LLM 提供符合 Zod 的结构化参数且合并默认值后符合 JSON Schema
- **THEN** 系统 MUST 执行 API 请求

#### Scenario: 仅业务校验失败

- **WHEN** 结构化参数通过 Zod，但合并后不符合 `parameterContract`
- **THEN** 系统 MUST NOT 发送 HTTP 请求
- **AND** MUST 返回与 Ajv 一致的错误信息供模型纠错

### Requirement: 普通用户会话不暴露内置 ssh_executor

在**默认**对话会话（普通用户）中，agent MUST NOT 将内置 **`ssh_executor`** 工具加入 LLM 可见工具列表。远程 shell 执行 MUST 仅通过 **扩展 SSH 类 Skill** 触发（由 agent-core 使用存库 `command` + 台账解析调用网关 SSH 能力）。实现 MAY 为管理员、调试模式或配置项保留挂载 `ssh_executor` 的例外。

#### Scenario: 普通用户仅能通过扩展 SSH Skill 执行远程命令

- **WHEN** 普通用户会话绑定工具并完成一轮对话
- **THEN** 可用工具列表 MUST NOT 包含 `ssh_executor`
- **AND** MUST 仍包含用户有权使用的扩展 SSH 类 Skill（若已启用）

#### Scenario: 扩展 SSH Skill 仍可执行远程命令

- **WHEN** LLM 调用某扩展 SSH 类 Skill 且参数有效
- **THEN** 系统 MUST 按该 Skill 存库 `command` 与台账解析执行远程命令
- **AND** MUST NOT 要求用户改用内置 `ssh_executor`
