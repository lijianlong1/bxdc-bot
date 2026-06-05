## MODIFIED Requirements

### Requirement: Agent can generate API skill from user description
系统 SHALL 支持一个 built-in skill，根据用户输入的 API 描述生成一条符合当前 Extended Skill 标准的 API 类型 skill 数据，生成结果至少包含 `name`、`description`、`type`、`configuration`、`enabled` 与 `requiresConfirmation`。

#### Scenario: Generate skill payload from complete API description
- **WHEN** 用户提供了完整的 API 描述，包含接口地址、请求方法、必填参数或鉴权信息
- **THEN** 系统生成一条 `type=EXTENSION` 的 skill 数据
- **AND** 生成的 `configuration` MUST 包含独立的接口说明字段，用于描述入参、出参、核心字段意义、限制、字典值或默认值
- **AND** 生成的 `configuration` MUST 包含可供运行时校验的参数格式契约
- **AND** 生成的 `configuration` MUST 符合当前 API 类型 skill 的执行协议
- **AND** 系统返回推荐的 skill 名称、用途描述和验证输入

#### Scenario: Reject incomplete API description
- **WHEN** 用户提供的 API 描述缺少关键执行信息，例如接口地址、请求方法、必填鉴权字段、关键参数约束或接口说明
- **THEN** 系统 MUST 不创建 skill
- **AND** 系统 MUST 明确指出缺失字段并要求用户补充

#### Scenario: Generated payload preserves routing summary
- **WHEN** 系统根据用户描述生成 API Skill
- **THEN** 生成结果中的 `description` MUST 保持为供 Agent 路由使用的简要用途描述
- **AND** 详细调用说明 MUST 写入独立的接口说明字段，而不是直接展开进 `description`
