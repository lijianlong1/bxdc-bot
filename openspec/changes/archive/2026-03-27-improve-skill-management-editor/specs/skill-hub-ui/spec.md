## ADDED Requirements

### Requirement: Skill 管理入口支持结构化维护
Skill Hub 的管理入口 SHALL 打开一个面向数据库 Skill 的结构化维护窗口，而不是仅提供原始 JSON 编辑方式。

#### Scenario: 打开 Skill 管理窗口
- **WHEN** 用户从 Skill Hub 进入 Skill 管理界面
- **THEN** 系统打开 Skill 管理窗口
- **AND** 该窗口提供按执行类型切换的结构化维护表单

#### Scenario: 切换执行类型
- **WHEN** 用户在 Skill 管理窗口中切换 `CONFIG` 与 `OPENCLAW` 执行类型
- **THEN** 系统切换到对应类型的结构化编辑区域
- **AND** 不继续显示单一的原始 JSON 文本框作为主要编辑方式

### Requirement: Skill 管理窗口展示协议化字段
Skill Hub 的管理窗口 SHALL 根据 Skill 执行类型展示匹配的协议字段，帮助用户理解当前维护对象。

#### Scenario: 展示 CONFIG 协议字段
- **WHEN** 管理窗口正在编辑一个 `CONFIG` Skill
- **THEN** 界面显示该 Skill 对应的结构化配置字段
- **AND** 用户可以从字段标签理解配置含义

#### Scenario: 展示 OPENCLAW 协议字段
- **WHEN** 管理窗口正在编辑一个 `OPENCLAW` Skill
- **THEN** 界面显示提示词、允许工具列表和编排相关字段
- **AND** 提示词输入区支持多行 Markdown 文本
