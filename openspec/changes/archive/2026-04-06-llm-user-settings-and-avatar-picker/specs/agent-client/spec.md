## ADDED Requirements

### Requirement: 用户 LLM 设置界面

前端客户端 MUST 提供界面供登录用户配置 OpenAI 兼容的 API base URL、模型名称与 API Key，并支持保存与更新。

#### Scenario: 打开设置并保存

- **WHEN** 用户在设置界面填写 base URL、模型名与 API Key 并提交
- **THEN** 客户端调用后端保存接口
- **AND** 成功后在界面展示已保存状态（不含完整 Key 明文）

#### Scenario: 掩码展示

- **WHEN** 用户再次打开设置且此前已保存过 API Key
- **THEN** 客户端展示「已配置」或掩码提示
- **AND** 不要求用户重新输入 Key 除非用户选择更换

### Requirement: 注册与资料中的头像交互

客户端 MUST 在注册与用户资料流程中提供 emoji 选择能力，并提供可选的「自动生成」操作；不得在无用户操作下自动请求 LLM 生成头像。

#### Scenario: 默认选择 emoji

- **WHEN** 用户完成注册或编辑资料且仅使用 emoji 选择器
- **THEN** 客户端不发送静默 LLM 头像生成请求

#### Scenario: 显式生成

- **WHEN** 用户点击「自动生成」
- **THEN** 客户端调用后端头像生成接口
- **AND** 根据响应更新预览或头像字段

#### Scenario: 无 Key 时禁用自动生成

- **WHEN** 当前解析得到的用于 LLM 的 API Key 为空（用户设置与环境均未提供）
- **THEN** 「自动生成」按钮处于禁用状态或等价不可交互
- **AND** 用户仍可使用 emoji 选择器
