# ai-avatar-generator

## Purpose

定义注册与资料流程中的 emoji 头像：以手动选择为默认路径，仅在用户显式操作后可选用 LLM 建议 emoji；无可用 API Key 或调用失败时回退，且不在未经用户操作时静默调用 LLM。

## Requirements

### Requirement: Emoji 头像选择与可选自动生成

系统 MUST 支持用户从 emoji 集合中手动选择头像作为默认路径；系统 MAY 在用户显式点击「自动生成」类操作后调用 LLM 根据昵称建议 emoji。系统 MUST NOT 在未经用户显式操作的情况下自动调用 LLM 生成头像作为唯一或默认方式。

#### Scenario: 手动选择头像

- **WHEN** 用户在注册或资料编辑界面从 emoji 选择器中选择一项
- **THEN** 系统将该 emoji 作为用户头像保存
- **AND** 不为此调用 LLM

#### Scenario: 显式触发生成

- **WHEN** 用户点击「自动生成」或等价按钮
- **THEN** 系统 MAY 调用 LLM 根据昵称返回一个 emoji
- **AND** 用户可确认或取消采用该结果

#### Scenario: 无 API Key 时不提供生成

- **WHEN** 合并用户配置与环境变量后的 API Key 仍为空
- **THEN** 系统不得向用户展示可点击的「自动生成」有效路径（前端禁用或后端拒绝）
- **AND** 用户仍可通过 emoji 选择器设定头像

#### Scenario: LLM 不可用或失败

- **WHEN** LLM 调用失败或未配置可用 Key
- **THEN** 系统返回默认 emoji（例如 👤）或保留用户已选 emoji
- **AND** 不向用户暴露敏感错误细节
