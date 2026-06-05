## ADDED Requirements

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
