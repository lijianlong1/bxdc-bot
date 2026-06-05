# api-skill-invocation — Delta

## MODIFIED Requirements

### Requirement: API Skill Invocation

Skill Gateway MUST 使用 LLM 提供的参数调用已配置的 API Skill，并应用与历史上 **agent-core 对扩展 API Skill** 相同的 **normalization** 规则（包括在使用的场景下从 `input`  unwrap JSON 字符串、以及在文档化场景下从 tool call 恢复等价的扁平参数）。当启用 **unified skill runtime** 时，Agent Core MUST 将 `arguments` 转发至 Gateway 的 **统一 execute** 端点，且 MUST NOT 在 Node 侧对 API Skill 执行 normalization、针对 `parameterContract` 的校验或出站 HTTP 组装。

#### Scenario: Successful invocation

- **WHEN** LLM 为某 API Skill 生成参数且 Agent 将其转发至 Gateway execute
- **WHEN** Gateway 成功完成 normalization 与校验
- **THEN** Gateway 使用规范化后的参数执行 API 请求
- **AND** 响应经 Agent 的 tool 结果路径返回给 LLM

#### Scenario: Failed invocation (validation error)

- **WHEN** LLM 生成的参数在 Gateway 侧 normalization 后仍无效（例如缺必填字段、类型不匹配、枚举违反）
- **THEN** Gateway MUST NOT 执行对外 API 请求
- **AND** Gateway MUST 返回可供 LLM 纠错的结构化错误信息
- **AND** LLM 可修正参数后再次调用该 Skill

### Requirement: 可配置的契约参数到 HTTP body（JSON）映射

对扩展 API Skill（及统一平台上的同源配置），在 `parameterContract` 校验通过且即将执行出站 HTTP 前，系统 SHALL 支持在 skill `configuration` 中通过显式字段声明：**合并后的契约参数**（defaults + LLM 提供值，且已排除保留键）映射到 **URL query** 或 **JSON request body**。**该合并与映射 MUST 在 Skill Gateway 统一 execute 路径内完成**（与既有 Node 实现行为等价）。

未设置该配置时，系统 SHALL 保持与变更前一致的默认映射（合并后的标量字段进入 query、`merged.body` 单独作为 body 的既有行为）。

#### Scenario: jsonBody 模式下发 POST JSON

- **WHEN** skill `configuration` 将参数绑定设置为 JSON body（例如 `parameterBinding` 为 `jsonBody`）
- **AND** HTTP method 为 POST、PUT 或 PATCH
- **AND** `parameterContract` 在顶层定义了若干属性（如 `id`、`nickname`、`systemAdminPassword`）
- **THEN** Gateway MUST 将这些合并后的字段序列化为 JSON 对象，作为发往 HTTP 代理请求中的 **body**
- **AND** Gateway MUST NOT 仅因 `merged.body` 为空而省略上述字段，以致请求体为空

#### Scenario: 默认 query 模式兼容旧 Skill

- **WHEN** skill 未启用 JSON body 映射（默认 `query` 或未设置）
- **THEN** Gateway MUST 继续将合并后的标量字段用于 URL query 构建（与既有实现一致）
- **AND** 已有未修改的 Skill MUST 行为不变

#### Scenario: GET 与 jsonBody 的合理行为

- **WHEN** `parameterBinding` 为 `jsonBody` 但 HTTP method 为 GET
- **THEN** Gateway MUST NOT 将 JSON body 作为 GET 语义的一部分强行发送；Gateway SHALL 回退为 query 映射或采用与实现文档一致的明确策略，且 MUST NOT 抛出未处理异常
