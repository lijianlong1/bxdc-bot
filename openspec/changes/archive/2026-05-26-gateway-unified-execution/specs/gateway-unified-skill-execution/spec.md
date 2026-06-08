## ADDED Requirements

### Requirement: 统一 Skill 执行端点

系统 SHALL 在 Skill Gateway 新增 `POST /api/skills/execute` 端点，接收 `{ skillId, parameters }` 格式的调用请求，内部完成执行分派并返回结果。端点需要 `X-Agent-Token` 认证。

#### Scenario: 接收合法执行请求

- **WHEN** 调用方以合法 `X-Agent-Token` 请求 `POST /api/skills/execute`，请求体包含 `skillId` 和 `parameters`
- **THEN** 系统根据 `skillId` 从 `skills` 表查询 Skill 配置
- **AND** 若 Skill 存在且已启用，进入执行分派流程

#### Scenario: Skill 不存在或已禁用

- **WHEN** `skillId` 对应的 Skill 不存在或 `enabled` 不为 `true`
- **THEN** 系统返回 404 错误，包含明确的错误描述

#### Scenario: 未认证请求被拒绝

- **WHEN** 请求未携带有效的 `X-Agent-Token`
- **THEN** 系统返回 401 错误

### Requirement: Gateway 侧 HTTP 请求组装

对 `kind=api` 的 Skill，系统 SHALL 在 Gateway 侧完成完整的 HTTP 请求组装，包括 URL 拼接、Header 合并、Body 构造和 `parameterBinding` 路由。组装信息来源于 Skill 持久化配置（`endpoint`、`method`、`headers`、`parameterBinding` 等字段）。

#### Scenario: query 模式下参数编入 URL

- **WHEN** Skill 的 `parameterBinding` 为 `query` 或未设置
- **AND** 调用方传入的参数为标量键值对
- **THEN** 系统将标量参数编码为 URL query string，拼接到 `endpoint` 后
- **AND** 系统将 Skill 配置的 `headers` 与调用方传入的 `headers` 合并（调用方优先）
- **AND** HTTP body 使用 Skill 配置中的 `body` 字段（若存在），否则为空

#### Scenario: jsonBody 模式下发 JSON 请求体

- **WHEN** Skill 的 `parameterBinding` 为 `jsonBody`
- **AND** HTTP method 为 POST、PUT 或 PATCH
- **THEN** 系统将调用方参数序列化为 JSON 对象作为请求 body
- **AND** 若 Skill 的 `headers` 中未显式指定 `Content-Type`，默认设置为 `application/json`

#### Scenario: formBody 模式下发表单请求体

- **WHEN** Skill 的 `parameterBinding` 为 `formBody`
- **AND** HTTP method 为 POST、PUT、PATCH 或 DELETE
- **AND** 调用方传入的参数均为平面标量值
- **THEN** 系统将参数按 `application/x-www-form-urlencoded` 规则编码为请求 body
- **AND** 若 `headers` 中未显式指定 `Content-Type`，默认设置为 `application/x-www-form-urlencoded`

#### Scenario: jsonBody/formBody 与 GET 方法冲突时回退

- **WHEN** `parameterBinding` 为 `jsonBody` 或 `formBody` 但 HTTP method 为 GET 或 HEAD
- **THEN** 系统回退为 query 映射
- **AND** MUST NOT 抛出未处理异常

#### Scenario: formBody 模式下参数非平面时拒绝

- **WHEN** `parameterBinding` 为 `formBody`
- **AND** 调用方参数中存在对象或数组等非标量值
- **THEN** 系统 MUST NOT 执行 HTTP 请求
- **AND** 返回结构化错误 `{ error: "formBody requires flat scalar parameters" }`

### Requirement: 参数默认值合并

对 `kind=api` 的 Skill，系统 SHALL 在组装 HTTP 请求前，从 Skill 的 `parameterContract.properties.*.default` 中提取默认值，与调用方传入参数合并，调用方传入值覆盖默认值。

#### Scenario: 调用方未提供字段时使用默认值

- **WHEN** Skill 的 `parameterContract` 中某字段定义了 `default` 值
- **AND** 调用方传入参数中不包含该字段
- **THEN** 系统使用该 `default` 值

#### Scenario: 调用方已提供字段时不使用默认值

- **WHEN** Skill 的 `parameterContract` 中某字段定义了 `default` 值
- **AND** 调用方传入参数中已包含该字段
- **THEN** 系统使用调用方传入的值

### Requirement: 按 kind 执行分派

系统 SHALL 根据 Skill 持久化的 `kind` 字段决定执行路径：`api` 走 HTTP 代理、`ssh` 走 SSH 执行、`template` 直接返回 prompt。

#### Scenario: API Skill 走 HTTP 代理

- **WHEN** Skill 的 `kind` 为 `api`
- **THEN** 系统完成 HTTP 请求组装（见 HTTP 请求组装 Requirement）
- **AND** 通过 `ApiProxyService` 发起对外 HTTP 请求
- **AND** 返回 HTTP 响应内容

#### Scenario: SSH Skill 走台账解析后执行

- **WHEN** Skill 的 `kind` 为 `ssh`
- **AND** 调用方提供了目标服务器标识
- **THEN** 系统通过台账解析连接信息
- **AND** 通过 `SSHExecutorService` 执行 Skill 配置中的 `command`
- **AND** 执行前 MUST 通过 `SecurityFilterService.isCommandSafe()` 安全检查

#### Scenario: Template Skill 直接返回 prompt

- **WHEN** Skill 的 `kind` 为 `template`
- **THEN** 系统直接返回 Skill 配置中的 `prompt` 文本内容
- **AND** MUST NOT 发起任何外部请求

### Requirement: Gateway 侧确认门

系统 SHALL 在执行 Skill 前，根据 Skill 持久化的 `requiresConfirmation` 字段判断是否需要用户确认。确认流程采用两次短连接实现，确认状态使用内存 Map 存储。

#### Scenario: 需确认时首次调用返回 CONFIRMATION_REQUIRED 且不执行

- **WHEN** Skill 的 `requiresConfirmation` 为 `true`
- **AND** 请求未携带 `confirmed: true`
- **THEN** 系统生成唯一 `requestId`
- **AND** 将确认状态（skillId、parameters、userId、expiresAt）存入内存 Map
- **AND** 返回 `{ status: "CONFIRMATION_REQUIRED", requestId, skillName, summary, parameters, expiresInSeconds }`
- **AND** MUST NOT 执行该 Skill 的实际逻辑

#### Scenario: 用户确认后执行

- **WHEN** 请求携带 `confirmed: true` 且 `requestId` 在内存 Map 中存在、未过期、且 userId 匹配
- **THEN** 系统使用 `adjustedParams`（若提供）覆盖原参数
- **AND** 进入执行分派，完成 Skill 的实际逻辑
- **AND** 返回执行结果
- **AND** 从内存 Map 中删除该 `requestId`

#### Scenario: requestId 无效或过期

- **WHEN** 请求携带 `confirmed: true` 但 `requestId` 不存在或已过期
- **THEN** 系统返回错误 `{ error: "Confirmation request not found or expired" }`
- **AND** MUST NOT 执行 Skill

#### Scenario: 不需确认的 Skill 直接执行

- **WHEN** Skill 的 `requiresConfirmation` 不为 `true`
- **THEN** 系统直接进入执行分派，不经过确认门

### Requirement: 确认状态过期清理

系统 SHALL 定期清理过期的确认状态记录。

#### Scenario: 定时清理

- **WHEN** 确认状态记录的 `expiresAt` 早于当前时间
- **THEN** 系统在定时任务中（每 60 秒）从内存 Map 移除该记录

### Requirement: 旧端点兼容包装

系统 SHALL 将现有冗余执行端点（`/api/skills/api`、`/api/skills/ssh`、`/api/skills/linux-script`、`/api/skills/compute`、`/api/system-skills/execute`）内部转调至新的 `POST /api/skills/execute`，使 Gateway 底层收敛为唯一执行路径。此阶段 Agent Core 不做任何改动。

#### Scenario: `/api/skills/api` 内部转调

- **WHEN** Agent Core 以既有格式调用 `POST /api/skills/api`
- **THEN** 系统解析旧请求体 → 匹配 `skills` 表对应记录 → 构造 `skillId` + `parameters` → 转调 `SkillExecutionService.execute()`
- **AND** 响应格式与既有行为一致
- **AND** 若无法匹配到对应 Skill，回退到旧执行路径并打 warn 日志

#### Scenario: `/api/skills/ssh` 内部转调

- **WHEN** Agent Core 调用 `POST /api/skills/ssh`
- **THEN** 系统解析参数 → 转调 `SkillExecutionService.execute()`（kind=ssh）

#### Scenario: `/api/skills/linux-script` 内部转调

- **WHEN** Agent Core 调用 `POST /api/skills/linux-script`
- **THEN** 系统解析参数 → 转调 `SkillExecutionService.execute()`（kind=ssh，自动走台账解析）

#### Scenario: `/api/skills/compute` 内部转调

- **WHEN** Agent Core 调用 `POST /api/skills/compute`
- **THEN** 系统解析参数 → 转调 `SkillExecutionService.execute()`

#### Scenario: `/api/system-skills/execute` 内部转调

- **WHEN** Agent Core 以 `AGENT_BUILTIN_SKILL_DISPATCH=gateway` 模式调用 `POST /api/system-skills/execute`
- **THEN** 系统解析 `toolName` → 查 `system_skills` 表 → 转调 `SkillExecutionService.execute()`

#### Scenario: 异步轮询端点暂不转调

- **WHEN** Agent Core 调用 `POST /api/skills/api/async`
- **THEN** 系统保持既有行为不变
- **AND** 本次不进行转调
