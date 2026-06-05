## ADDED Requirements

### Requirement: Skill 新增与编辑支持公共/私人

系统 SHALL 在 Skill 管理窗口的新建与编辑流程中提供 **公共 / 私人** 可见性选择，并将选择结果随保存请求提交给后端。

#### Scenario: 新建 Skill 时选择可见性

- **WHEN** 用户在管理窗口新建数据库 Skill
- **THEN** 界面提供「公共」与「私人」选项（或等价控件）
- **AND** 可见性初始值 MUST 为 **私人**（与 `skill-visibility` 中「新建数据库 Skill 默认私人」一致）
- **AND** 用户提交保存时请求体包含所选可见性（未更改则仍为私人）

#### Scenario: 编辑 Skill 时查看与修改可见性

- **WHEN** 用户打开本人有权编辑的 Skill
- **THEN** 界面展示当前 Skill 的可见性
- **AND** 用户可在允许范围内修改可见性并保存

#### Scenario: 无编辑权限时不展示可写表单

- **WHEN** 用户尝试编辑他人 `PRIVATE` Skill（例如通过深链或陈旧列表）
- **THEN** 系统不展示可提交编辑的表单，或展示与越权一致的错误提示
- **AND** 用户无法通过该界面修改该 Skill
