## ADDED Requirements

### Requirement: 自主规划 Skill 内部轨迹展示

界面 MUST 在自主规划类 skill 的主条目下展示其内部子工具调用轨迹，帮助用户理解执行过程。

#### Scenario: 展示自主规划 skill 的子工具轨迹

- **WHEN** assistant 回复过程中触发一个 `自主规划` 类型的 skill，且该 skill 内部又调用了多个子工具
- **THEN** 聊天窗口在该 skill 主条目下方按执行顺序展示子工具轨迹
- **AND** 用户可以识别这些子工具属于哪个外层 skill

#### Scenario: 子工具轨迹最小展示信息

- **WHEN** 某个子工具轨迹条目被渲染
- **THEN** 条目显示子工具名称与执行状态
- **AND** 可显示简短摘要信息
- **AND** 不要求默认展示完整原始参数与响应体

#### Scenario: 预配置 skill 不显示伪层级

- **WHEN** assistant 回复过程中触发一个 `预配置` 类型的 skill
- **THEN** 界面仍按现有单层 skill 条目展示
- **AND** 不为没有内部编排的 skill 人为渲染子工具层级
