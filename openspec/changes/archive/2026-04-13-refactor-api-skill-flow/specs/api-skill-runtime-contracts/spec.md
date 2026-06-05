## ADDED Requirements

### Requirement: API Skill 调用说明渐进披露
系统 SHALL 将 API Skill 的简要用途描述与详细接口说明分离，并在 Agent 调用链路中按阶段披露。

#### Scenario: 路由阶段仅暴露简要说明
- **WHEN** Agent 仅在候选 Skill 中做路由选择
- **THEN** 系统 MUST 仅向 Agent 提供 API Skill 的简要 `description`
- **AND** 系统 MUST NOT 在该阶段附带完整接口说明、字段字典或出参细节

#### Scenario: 调用阶段注入详细接口说明
- **WHEN** Agent 已确定准备调用某个 API Skill
- **THEN** 系统 MUST 在该次调用上下文中注入该 Skill 的详细接口说明
- **AND** 详细接口说明 MUST 包含入参说明、出参说明、核心字段意义、限制、字典值和默认值（若已配置）

### Requirement: API Skill 请求前严格参数校验
系统 SHALL 在发起外部 API 请求前，依据 Skill 登记的参数格式契约对模型输出进行严格校验。

#### Scenario: 参数通过契约校验
- **WHEN** Agent 为某个 API Skill 生成的调用参数满足该 Skill 登记的参数格式契约
- **THEN** 系统 MUST 继续构造请求并发起外部 API 调用

#### Scenario: 参数缺少必填字段
- **WHEN** Agent 生成的调用参数缺少 Skill 契约要求的必填字段
- **THEN** 系统 MUST 阻止外部请求发送
- **AND** 系统 MUST 返回结构化错误，指出缺失字段

#### Scenario: 参数类型或枚举值不匹配
- **WHEN** Agent 生成的调用参数类型错误，或枚举值不在 Skill 契约允许范围内
- **THEN** 系统 MUST 阻止外部请求发送
- **AND** 系统 MUST 返回结构化错误，指出不匹配字段与预期格式

#### Scenario: 存在默认值时自动补齐
- **WHEN** Skill 参数契约为某个非必填字段声明了默认值且 Agent 未提供该字段
- **THEN** 系统 MAY 在通过契约定义的前提下自动补齐默认值
- **AND** 自动补齐后的参数 MUST 仍然满足同一份契约校验
