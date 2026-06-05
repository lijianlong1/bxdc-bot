## MODIFIED Requirements

### Requirement: CONFIG Skill 结构化维护
系统 SHALL 为 `CONFIG` 类型数据库 Skill 提供结构化字段维护界面，而不是要求用户直接编辑完整 `configuration` JSON。

#### Scenario: 新建 CONFIG Skill
- **WHEN** 用户在 Skill 管理窗口中选择 `executionMode=CONFIG`
- **THEN** 系统展示与 `CONFIG` 协议对应的结构化字段表单
- **AND** 用户无需手写完整 JSON 即可填写配置主体

#### Scenario: 按 kind 展示字段
- **WHEN** 用户为 `CONFIG` Skill 选择具体的配置类型或 `kind`
- **THEN** 系统仅展示该 `kind` 所需的配置字段
- **AND** 不要求用户理解其他无关协议字段

#### Scenario: 保存 CONFIG Skill
- **WHEN** 用户提交一个通过校验的 `CONFIG` Skill 表单
- **THEN** 系统将结构化字段序列化为持久化所需的 `configuration` JSON
- **AND** 保存请求中的协议字段与表单输入保持一致

#### Scenario: 编辑 API Skill 接口说明
- **WHEN** 用户编辑 `kind=api` 的 Skill
- **THEN** 表单 MUST 提供独立的接口说明字段
- **AND** 该字段 MUST 支持录入入参说明、出参说明、核心字段意义、限制、字典值和默认值
- **AND** 该字段内容 MUST 被持久化到 API Skill 配置中，而不是混入简要 `description`

#### Scenario: 编辑 API Skill 参数契约
- **WHEN** 用户编辑 `kind=api` 的 Skill
- **THEN** 表单 MUST 提供可维护的参数格式定义
- **AND** 该定义 MUST 能表达字段名、类型、必填约束、枚举值或默认值
- **AND** 保存后生成的配置 MUST 能被运行时用于严格参数校验

### Requirement: 结构化校验与保存保护
系统 SHALL 在结构化保存前校验必填字段与协议合法性，避免生成无效配置。

#### Scenario: 缺少必填字段
- **WHEN** 用户提交的 Skill 表单缺少当前协议要求的关键字段
- **THEN** 系统阻止保存
- **AND** 向用户指出缺失或不合法的字段

#### Scenario: 生成合法 configuration
- **WHEN** 用户提交一个通过校验的 Skill 表单
- **THEN** 系统生成合法 JSON 格式的 `configuration`
- **AND** 生成过程保留 Markdown 换行、引号与数组内容的正确转义

#### Scenario: 接口说明或参数契约不合法
- **WHEN** 用户提交的 API Skill 缺少接口说明，或参数格式定义无法解析为合法契约
- **THEN** 系统 MUST 阻止保存
- **AND** 系统 MUST 明确指出是接口说明缺失还是参数格式定义不合法
