## ADDED Requirements

### Requirement: 扩展 Skill 注册与路由策略衔接

SkillGateway 返回并注册的 EXTENSION 技能（见既有 **Dynamic Skill Discovery**）SHALL 作为 Agent **扩展 Skill 优先**策略（`agent-extended-skill-priority`）中「已加载工具集合」的唯一来源；实现 SHALL 确保加载失败的技能不会出现在「优先使用」列表中。

#### Scenario: 注册失败不宣称可用

- **WHEN** 某扩展 Skill 因网关错误或权限未出现在当前会话工具列表中
- **THEN** 路由策略 SHALL NOT 指示模型调用该名称
