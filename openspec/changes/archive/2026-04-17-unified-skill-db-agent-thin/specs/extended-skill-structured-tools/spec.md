# extended-skill-structured-tools — Delta

## MODIFIED Requirements

### Requirement: API 扩展 Skill 执行路径保持 JSON Schema 校验

对 **API** 类扩展 Skill（及统一平台上的同类 Skill），在发往外部 HTTP 前，系统 MUST 依据存库 `parameterContract` 使用 **Ajv（或与 design 声明等价的校验）** 对合并后的 payload 进行校验。**在启用 unified skill runtime 时，该校验 MUST 在 Skill Gateway 统一 execute 路径内完成**；工具侧（Agent）的 Zod 仅用于 **LLM 边界**，**MUST NOT** 作为唯一业务校验后再在 Node 侧独立组装完整出站请求（与已迁移的 `api-skill-invocation` delta 一致）。

#### Scenario: 工具边界与业务校验均通过

- **WHEN** LLM 提供符合 Zod 的结构化参数且 Gateway 合并默认值后符合 JSON Schema
- **THEN** Gateway MUST 执行 API 请求（经代理）

#### Scenario: 仅业务校验失败

- **WHEN** 结构化参数通过 Zod，但合并后不符合 `parameterContract`
- **THEN** Gateway MUST NOT 发送 HTTP 请求
- **AND** MUST 返回与 Ajv 一致的错误信息供模型纠错（经 Agent 作为 ToolMessage 透传）
