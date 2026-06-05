## ADDED Requirements

### Requirement: 生成并保存的 Skill 归属当前登录用户

所有通过 built-in skill 生成流程保存到 SkillGateway 的数据库 Skill MUST 将 **创建者** 设为 **当前登录用户**，并 MUST 符合 `skill-visibility` 中关于默认可见性与列表过滤的约定。

#### Scenario: SSH 生成保存记录创建者

- **WHEN** 生成器输出 SSH `CONFIG` skill 并成功保存到 SkillGateway
- **THEN** 持久化记录中的创建者 MUST 为当前会话用户

#### Scenario: OPENCLAW 生成保存记录创建者

- **WHEN** 生成器输出 OPENCLAW skill 并成功保存到 SkillGateway
- **THEN** 持久化记录中的创建者 MUST 为当前会话用户

#### Scenario: Template CONFIG 生成保存记录创建者

- **WHEN** 生成器输出 template `CONFIG` skill 并成功保存到 SkillGateway
- **THEN** 持久化记录中的创建者 MUST 为当前会话用户

#### Scenario: 多类型生成工具统一归属

- **WHEN** `JavaSkillGeneratorTool`（或等价工具）将 skill 写入 SkillGateway
- **THEN** 写入记录 MUST 携带当前用户作为创建者
