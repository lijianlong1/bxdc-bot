# api-skill-invocation

## Purpose

定义已配置 API Skill 的调用行为：在参数校验通过后执行 HTTP 请求并将结果返回给 LLM；校验失败时不发起请求并返回可纠错信息。对扩展 API Skill，调用前 MUST 应用与 agent 运行时一致的参数归一化（含 `input` 字符串解析与文档化的工具调用参数恢复）。
## Requirements
### Requirement: API Skill Invocation

The system MUST invoke the configured API skill using the parameters provided by the LLM after applying the same **normalization** rules as the agent runtime (including unwrapping a JSON string from `input` when used, and recovery of equivalent flat arguments from the tool call when documented for extension API skills).

#### Scenario: Successful invocation

- **WHEN** the LLM generates valid parameters for an API skill after normalization
- **THEN** the system executes the API request with the normalized parameters
- **AND** the system returns the API response to the LLM

#### Scenario: Failed invocation (validation error)

- **WHEN** the LLM generates invalid parameters for an API skill (e.g., missing required fields, type mismatch, enum violation) after normalization
- **THEN** the system MUST NOT execute the API request
- **AND** the system MUST return a structured error message to the LLM indicating the validation failures
- **AND** the LLM CAN attempt to correct the parameters and invoke the skill again

### Requirement: 可配置的契约参数到 HTTP body（JSON）映射

对扩展 API Skill，在 `parameterContract` 校验通过且即将调用 Skill Gateway 的 HTTP 代理前，系统 SHALL 支持在 skill `configuration`（`ExtendedSkillConfig`）中通过显式字段声明：**合并后的契约参数**（defaults + LLM 提供值，且已排除保留键）映射到 **URL query** 或 **JSON request body**。

未设置该配置时，系统 SHALL 保持与变更前一致的默认映射（合并后的标量字段进入 query、`merged.body` 单独作为 body 的既有行为）。

#### Scenario: jsonBody 模式下发 POST JSON

- **WHEN** skill `configuration` 将参数绑定设置为 JSON body（例如 `parameterBinding` 为 `jsonBody`）
- **AND** HTTP method 为 POST、PUT 或 PATCH
- **AND** `parameterContract` 在顶层定义了若干属性（如 `id`、`nickname`、`systemAdminPassword`）
- **THEN** 系统 MUST 将这些合并后的字段序列化为 JSON 对象，作为发往网关代理请求中的 **body**
- **AND** 系统 MUST NOT 仅因 `merged.body` 为空而省略上述字段，以致请求体为空

#### Scenario: 默认 query 模式兼容旧 Skill

- **WHEN** skill 未启用 JSON body 映射（默认 `query` 或未设置）
- **THEN** 系统 MUST 继续将合并后的标量字段用于 URL query 构建（与既有实现一致）
- **AND** 已有未修改的 Skill MUST 行为不变

#### Scenario: GET 与 jsonBody 的合理行为

- **WHEN** `parameterBinding` 为 `jsonBody` 但 HTTP method 为 GET
- **THEN** 系统 MUST NOT 将 JSON body 作为 GET 语义的一部分强行发送；系统 SHALL 回退为 query 映射或采用与实现文档一致的明确策略，且 MUST NOT 抛出未处理异常

### Requirement: 可配置的契约参数到 form-urlencoded request body 映射

对扩展 API Skill，在 `parameterContract` 校验通过且即将调用 Skill Gateway 的 HTTP 代理前，系统 SHALL 支持在 skill `configuration`（`ExtendedSkillConfig`）中通过 `parameterBinding` 声明：将**合并后的契约参数**（defaults + LLM 提供值，且已排除保留键）在允许的 HTTP 方法下映射为 **`application/x-www-form-urlencoded` 请求体**（而非 JSON 对象）。

对合并后用于编码为表单的对象，系统 SHALL 仅支持**平面**标量值（`string` / `number` / `boolean`）；若合并结果中存在无法编码为表单项的嵌套结构，系统 MUST NOT 执行对外 API 请求，MUST 返回可纠错的结构化错误信息。

`Content-Type` 在 skill `headers` 未显式指定时 SHALL 默认为 `application/x-www-form-urlencoded`（实现 MAY 附加 `charset`）。

#### Scenario: formBody 模式下发 POST 表单体

- **WHEN** skill `configuration` 将参数绑定设置为 **form body**（`parameterBinding` 为 `formBody` 或与实现文档一致的同义取值）
- **AND** HTTP method 为 POST、PUT、PATCH 或 DELETE
- **AND** `parameterContract` 在顶层定义了若干属性，合并后的值为合法平面标量
- **THEN** 系统 MUST 将这些字段按 `application/x-www-form-urlencoded` 规则编码为**字符串实体**，作为发往网关代理请求中的 `body`
- **AND** 系统 MUST NOT 使用 `application/json` 作为该出站请求的默认 `Content-Type`（除非用户通过 `headers` 显式覆盖且行为以透传定义为准）

#### Scenario: 与默认 query 及 jsonBody 的兼容性

- **WHEN** skill 未启用 form body 映射（`parameterBinding` 非 `formBody`）
- **THEN** 系统 MUST 不引入本要求所述的 form-urlencoded 行为；未修改配置的历史 Skill MUST 与变更前行为一致

#### Scenario: GET/HEAD 与 formBody 的合理行为

- **WHEN** `parameterBinding` 为 `formBody` 但 HTTP method 为 GET 或 HEAD
- **THEN** 系统 MUST NOT 为 GET/HEAD 强制定义与 POST 相同的「仅 body 携带契约字段」行为；系统 SHALL 采用与现网 `jsonBody` 在 GET/HEAD 上**等价**的已文档化回退策略（例如回退为 query 映射），且 MUST NOT 抛出未处理异常

#### Scenario: 非平面合并结果拒绝发请求

- **WHEN** `parameterBinding` 为 `formBody`
- **AND** 合并后对象中存在对象或数组等无法按 MVP 规则编码为平面表单字段的条目
- **THEN** 系统 MUST NOT 执行对上游 API 的 HTTP 请求
- **AND** 系统 MUST 返回可纠错的错误信息，提示调用方调整契约或参数形状

### Requirement: 扩展 API Skill 与 built-in `api_caller` 的 Agent 侧执行路线区分

对 **类型为 `EXTENSION`、且 HTTP 能力由持久化 `configuration` 与 `executeConfiguredApiSkill` 实现的 API Skill**（以下称「扩展 API Skill」），系统 SHALL 在 **Agent 进程内** 将 LLM 提供的参数与 Skill `configuration` 合并并校验后，向 Skill Gateway 发送 **HTTP 代理** 请求；该路径 MUST **不** 依赖、也 MUST **不** 等同于在同一对话中再调用 **名为 `api_caller` 的 built-in 工具**（`JavaApiTool`）。

对扩展 API Skill，Agent Core SHALL 将合并后的 `url`（含 query）、`method`、`headers`、`body` 以 JSON body 形式提交到 **`POST {GATEWAY_BASE}/api/skills/api`**（与项目代码中 `executeConfiguredApiSkill` 行为一致），并由 Gateway 的 HTTP 代理服务出站。

**MUST NOT** 将上述行为描述为「通过 `api_caller` 内置 Skill 实现扩展 API Skill」；`api_caller` 是 **独立** 的 built-in 工具，仅在 Agent **注册** 该工具时，由模型选择调用，其出站到 Gateway 的 **HTTP 入口** 可与扩展路径不同（例如经 `AGENT_BUILTIN_SKILL_DISPATCH=gateway` 时使用 `POST {GATEWAY_BASE}/api/system-skills/execute` 且 `toolName` 为 `api_caller`），但与扩展 Skill 的 **工具注册与调用图** 无关。

#### Scenario: 仅存在扩展 API Skill 且未注册 `api_caller` 时仍可出站

- **WHEN** 某部署中 Agent **未** 向 LLM 注册 `api_caller`（`JavaApiTool`）  
- **AND** 已加载并启用至少一个扩展 API Skill  
- **THEN** 模型对该扩展 Skill 的 tool 调用 SHALL 仍能通过 `POST /api/skills/api` 完成 HTTP 执行  
- **AND** 该过程 MUST NOT 要求或触发对 `api_caller` 工具名的调用

#### Scenario: 文档与实现叙述一致性

- **WHEN** 维护者阅读 OpenSpec 与本变更相关的实现说明  
- **THEN** 其 MUST 能区分 **扩展 API Skill** 的 `executeConfiguredApiSkill` → `/api/skills/api` 路线与 **可选 built-in** `api_caller` 路线，避免将两者混写为同一条「内置包裹扩展」的调用链

