## ADDED Requirements

### Requirement: 层级化 Skill 轨迹解析

前端客户端 MUST 能解析带有父子关系的 skill/tool 事件，并将自主规划 skill 的内部子工具轨迹关联到对应外层 skill。

#### Scenario: 解析外层与子工具关系

- **WHEN** SSE 事件中包含自主规划 skill 主条目及其子工具轨迹
- **THEN** 客户端识别外层 skill 与子工具之间的归属关系
- **AND** 将子工具轨迹挂载到对应的外层 skill 下

#### Scenario: 维护子工具顺序

- **WHEN** 同一个自主规划 skill 在一次回复中连续触发多个子工具
- **THEN** 客户端按实际接收顺序维护这些子工具条目
- **AND** 后续状态更新不会打乱既有顺序

#### Scenario: 兼容旧版单层事件

- **WHEN** SSE 中只包含现有单层 skill 事件而没有父子关系字段
- **THEN** 客户端继续按现有方式解析
- **AND** 不因缺少新字段而导致消息渲染失败
