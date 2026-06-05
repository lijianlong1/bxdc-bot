## ADDED Requirements

### Requirement: 自主规划 Skill 轨迹事件

任务事件流 MUST 支持输出自主规划 skill 及其内部子工具调用的层级化轨迹事件。

#### Scenario: 输出外层 skill 与子工具事件

- **WHEN** Agent 执行一个自主规划类 skill，且该 skill 内部调用了子工具
- **THEN** 任务事件流输出外层 skill 事件
- **AND** 也输出对应的子工具轨迹事件

#### Scenario: 子工具事件可关联父级

- **WHEN** 任务事件流输出某个子工具轨迹事件
- **THEN** 事件中包含可用于关联所属外层 skill 的稳定标识
- **AND** 前端客户端可据此恢复层级结构

#### Scenario: 兼容旧版 skill 事件

- **WHEN** Agent 执行的是没有内部编排的传统 skill
- **THEN** 任务事件流仍可只输出现有单层 skill 事件
- **AND** 不要求为所有 skill 强制附加子工具层级字段
