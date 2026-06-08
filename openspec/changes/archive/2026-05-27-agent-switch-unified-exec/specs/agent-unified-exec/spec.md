## MODIFIED Requirements

### Requirement: 扩展 Skill 统一执行调用

Agent Core 在通过 DynamicStructuredTool 执行扩展 Skill 时，SHALL 将完整的参数对象（已合并默认值且通过 Ajv 校验）提交至 Gateway 的 `POST /api/skills/execute` 端点，由 Gateway 完成 HTTP 请求组装和执行分派。Agent Core MUST NOT 在本地完成 URL 拼接、Header 合并、Body 构造或 parameterBinding 路由。

#### Scenario: API Skill 统一调 Gateway

- **WHEN** LLM 调用某扩展 API Skill 工具，且参数通过 Ajv 校验
- **THEN** Agent Core 将 `{ skillId, parameters: merged }` 提交至 `POST {gatewayUrl}/api/skills/execute`
- **AND** Agent Core MUST NOT 在本地执行 `executeConfiguredApiSkill` 或对参数做 HTTP 请求组装

#### Scenario: SSH Skill 统一调 Gateway

- **WHEN** LLM 调用某扩展 SSH Skill 工具，且参数通过 Ajv 校验
- **THEN** Agent Core 将 `{ skillId, parameters: merged }` 提交至 Gateway
- **AND** Gateway 内部完成台账解析和 SSH 执行
- **AND** Agent Core 删除 `executeServerResourceStatusSkill` 函数

#### Scenario: Template Skill 统一调 Gateway

- **WHEN** LLM 调用某扩展 Template Skill 工具
- **THEN** Agent Core 将 `{ skillId, parameters }` 提交至 Gateway
- **AND** Gateway 返回 `configuration.prompt` 文本

#### Scenario: OPENCLAW 不受影响

- **WHEN** LLM 调用某 OPENCLAW 类型 Skill
- **THEN** Agent Core 继续使用 `executeOpenClawSkill` 本地执行子规划
- **AND** 不经过 `POST /api/skills/execute`

### Requirement: 参数保留在 Agent 侧

Agent Core SHALL 在调用 Gateway 前完成参数默认值收集和 Ajv 校验。默认值使用 `parameterContract.properties.*.default`，合并规则为调用方传入值覆盖默认值。校验使用 Ajv 对合并后的完整参数对象进行 JSON Schema 校验。

#### Scenario: 默认值合并

- **WHEN** Skill 的 `parameterContract` 中某字段定义了 `default` 值
- **AND** LLM 未提供该字段
- **THEN** Agent Core 使用该默认值

#### Scenario: Ajv 校验失败时反馈 LLM

- **WHEN** 合并后的参数不符合 `parameterContract` 的 JSON Schema 约束
- **THEN** Agent Core 返回结构化校验错误给 LLM
- **AND** MUST NOT 向 Gateway 发起调用

### Requirement: 确认流适配 Gateway 返回

Agent Core SHALL 在收到 Gateway `POST /api/skills/execute` 返回的 `{ status: "CONFIRMATION_REQUIRED", requestId, ... }` 时触发确认流程，而不再自行读取 Skill 的 `requiresConfirmation` 字段判断。

#### Scenario: 收到 CONFIRMATION_REQUIRED 时触发中断

- **WHEN** Gateway 返回 `{ status: "CONFIRMATION_REQUIRED", requestId, skillName, parameters, expiresInSeconds }`
- **THEN** Agent Core 触发 LangGraph interrupt
- **AND** 通过 SSE 向前端推送 confirmation_request 事件，包含 Gateway 返回的全部字段

#### Scenario: 用户确认后带 requestId 重调 Gateway

- **WHEN** 用户在前端确认操作
- **THEN** Agent Core resume 后向 Gateway 发送 `{ skillId, parameters, confirmed: true, requestId, adjustedParams }`
- **AND** Gateway 校验 requestId 后执行

#### Scenario: 不需确认的 Skill 无中断

- **WHEN** Gateway 返回正常执行结果（不含 `CONFIRMATION_REQUIRED` 状态）
- **THEN** Agent Core 不触发 interrupt
- **AND** 直接将结果返回给 LLM

## REMOVED Requirements

### Requirement: Agent Core 侧 HTTP 请求组装

Agent Core MUST NOT 在本地执行 HTTP 请求组装逻辑。以下函数 SHALL 被移除：

- `toQueryRecord` / `buildUrlWithQuery`
- `mergeHeadersForApiProxy`
- `mergeJsonBodyForProxy`
- `normalizeParameterBindingValue`
- `collectMergedScalarFields`

#### Scenario: Agent 不再拼装 HTTP 请求

- **WHEN** 扩展 API Skill 需要调用外部 HTTP API
- **THEN** Agent Core 将参数提交至 Gateway
- **AND** Gateway 根据 Skill 配置（`endpoint`、`method`、`headers`、`parameterBinding`）拼装 HTTP 请求
- **AND** Agent Core 代码库中不存在上述 HTTP 组装函数

### Requirement: Agent Core 侧执行分派

Agent Core MUST NOT 根据 Skill 的 `kind` 字段决定执行路径。`executeConfiguredApiSkill`、`executeServerResourceStatusSkill`、`executeCurrentTimeSkill` 以及对应的 kind 分派分支 SHALL 被移除。

#### Scenario: Agent 不再做 kind 分派

- **WHEN** 扩展 Skill 的 func 被调用
- **THEN** Agent Core 统一提交至 `POST /api/skills/execute`
- **AND** 不存在 `if (kind === 'api')` 等分支代码

### Requirement: Agent Core 侧确认判断

Agent Core MUST NOT 在工具调用前读取 Skill 的 `requiresConfirmation` 字段自行判断。`applyExtendedSkillConfirmationGate` 函数 SHALL 被移除。

#### Scenario: Agent 不再自行判断需不需要确认

- **WHEN** 扩展 Skill 工具被调用
- **THEN** Agent Core 不读取 `requiresConfirmation` 字段
- **AND** 确认判断由 Gateway 在 `/execute` 内部完成

### Requirement: Gateway 旧执行端点

Skill Gateway MUST NOT 继续暴露以下冗余执行端点。对应的 Controller 方法和 SecurityConfig 放通规则 SHALL 被移除：

- `POST /api/skills/api`
- `POST /api/skills/ssh`
- `POST /api/skills/linux-script`
- `POST /api/skills/compute`

#### Scenario: 旧端点不可用

- **WHEN** 调用方请求 `POST /api/skills/api` 或 `POST /api/skills/ssh` 等已下线的端点
- **THEN** Gateway 返回 404
