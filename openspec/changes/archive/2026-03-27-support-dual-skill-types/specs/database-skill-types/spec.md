## ADDED Requirements

### Requirement: 数据库 Skill 执行类型
系统 MUST 为每条数据库 skill 持久化独立的执行类型字段，用于区分确定性配置驱动 skill 与 OpenClaw 风格 prompt skill。

#### Scenario: 创建配置驱动 skill
- **WHEN** 用户或初始化脚本创建一个传统的 API、时间或监控类数据库 skill
- **THEN** 该记录保存 `executionMode=CONFIG`
- **AND** 保留现有 `type=EXTENSION` 等来源字段语义不变

#### Scenario: 创建 OpenClaw 风格 skill
- **WHEN** 用户或初始化脚本创建一个 prompt 编排型数据库 skill
- **THEN** 该记录保存 `executionMode=OPENCLAW`
- **AND** 其配置内容按 prompt/orchestration 协议存储

#### Scenario: 兼容历史数据库记录
- **WHEN** 系统读取一个未显式携带 `executionMode` 的历史数据库 skill
- **THEN** 该记录被视为 `CONFIG`
- **AND** 不因缺少新字段而从可用 skill 列表中消失

### Requirement: 数据库 Skill 列表返回类型元数据
SkillGateway MUST 在数据库 skill 的列表与详情响应中返回稳定的执行类型元数据，供 Agent 与前端直接消费。

#### Scenario: 查询技能列表
- **WHEN** 客户端调用技能列表接口
- **THEN** 每条数据库 skill 响应都包含 `executionMode`
- **AND** 响应中的该字段与数据库持久化值一致

#### Scenario: 查询技能详情
- **WHEN** 客户端读取某条数据库 skill 详情
- **THEN** 返回值包含其 `executionMode`
- **AND** 调用方无需解析 `configuration` 才能判断 skill 类型

### Requirement: Agent 按执行类型加载数据库 Skill
Agent Core MUST 同时加载 `CONFIG` 与 `OPENCLAW` 两类数据库 skill，并按执行类型分配到对应执行器。

#### Scenario: 加载配置驱动 skill
- **WHEN** Agent Core 从 SkillGateway 获取到一个 `executionMode=CONFIG` 且启用中的数据库 skill
- **THEN** 将其注册为数据库 tool
- **AND** 调用时继续走既有的配置驱动执行逻辑

#### Scenario: 加载 OpenClaw 风格 skill
- **WHEN** Agent Core 从 SkillGateway 获取到一个 `executionMode=OPENCLAW` 且启用中的数据库 skill
- **THEN** 将其注册为数据库 tool
- **AND** 调用时交由 prompt/orchestration 执行器处理

#### Scenario: 忽略未启用 skill
- **WHEN** SkillGateway 返回某条 `enabled=false` 的数据库 skill
- **THEN** Agent Core 不将其注册为可调用 tool
- **AND** 该规则对 `CONFIG` 与 `OPENCLAW` 两类 skill 一致生效
