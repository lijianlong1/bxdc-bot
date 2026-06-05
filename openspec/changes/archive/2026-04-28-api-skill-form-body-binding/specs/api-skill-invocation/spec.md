# api-skill-invocation — Delta

## ADDED Requirements

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
