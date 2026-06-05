## ADDED Requirements

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

### Requirement: OPENCLAW Skill 结构化维护
系统 SHALL 为 `OPENCLAW` 类型数据库 Skill 提供专门的结构化维护界面，覆盖提示词、工具白名单与编排字段。

#### Scenario: 新建 OPENCLAW Skill
- **WHEN** 用户在 Skill 管理窗口中选择 `executionMode=OPENCLAW`
- **THEN** 系统展示 `OPENCLAW` 专用字段表单
- **AND** 该表单至少包含提示词、允许工具列表与编排模式字段

#### Scenario: 使用 Markdown 编辑提示词
- **WHEN** 用户编辑 `OPENCLAW` Skill 的提示词
- **THEN** 系统允许用户输入多行 Markdown 文本
- **AND** 保存时将该文本写入持久化配置中的 `systemPrompt`

#### Scenario: 维护 allowedTools
- **WHEN** 用户编辑 `OPENCLAW` Skill 的允许工具列表
- **THEN** 系统以结构化列表方式维护 `allowedTools`
- **AND** 不要求用户手写 JSON 数组

#### Scenario: 仅用提示词创建 OPENCLAW Skill
- **WHEN** 用户创建 `OPENCLAW` Skill 时只填写提示词而未选择任何允许工具
- **THEN** 系统允许保存该 Skill
- **AND** 持久化配置中的 `allowedTools` 可以为空数组

### Requirement: 历史 Skill 配置回填
系统 SHALL 在编辑已有数据库 Skill 时解析其持久化 `configuration`，并尽可能回填到结构化表单。

#### Scenario: 回填已有 CONFIG Skill
- **WHEN** 用户打开一个现有 `CONFIG` Skill 的编辑窗口
- **THEN** 系统解析其 `configuration`
- **AND** 将可识别字段回填到对应的结构化输入项中

#### Scenario: 回填已有 OPENCLAW Skill
- **WHEN** 用户打开一个现有 `OPENCLAW` Skill 的编辑窗口
- **THEN** 系统解析其 `systemPrompt`、`allowedTools` 与编排字段
- **AND** 在结构化表单中展示这些值

#### Scenario: 无法安全解析历史配置
- **WHEN** 系统无法将已有 Skill 的 `configuration` 安全映射到当前结构化表单
- **THEN** 系统向用户展示明确的解析失败提示
- **AND** 系统不得静默丢弃未知字段后直接覆盖保存

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
