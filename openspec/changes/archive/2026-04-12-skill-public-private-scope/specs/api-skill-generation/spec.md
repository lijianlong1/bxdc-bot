## MODIFIED Requirements

### Requirement: Generated API skill is persisted using current skill standard

系统 SHALL 将生成出的 API skill 通过现有 SkillGateway 持久化接口写入数据库，并保证写入后的记录能够被当前动态加载机制识别。保存时 MUST 设置 **创建者为当前登录用户**，并 MUST 写入可见性字段（默认策略与 `skill-visibility` / 设计文档一致，例如默认 `PRIVATE`）。保存后的 skill MUST 出现在 **当前用户** 调用的 `GET /api/skills` 结果中（且遵守公共/私人过滤规则）。

#### Scenario: Save newly generated API skill

- **WHEN** built-in skill 成功生成了合法的 API skill 数据
- **THEN** 系统 MUST 调用现有 SkillGateway skill 管理接口保存该 skill
- **THEN** 保存结果 MUST 使用当前 `skills` 表标准字段，并包含 `createdBy` 与可见性
- **THEN** 保存后的 skill MUST 能被当前用户在 `GET /api/skills` 中查询到

#### Scenario: Update existing generated skill with same target name

- **WHEN** 系统检测到待创建的 skill 名称已存在且用户选择覆盖或更新
- **THEN** 系统 MUST 仅在授权允许时更新现有 skill 配置而不是创建重复记录
- **THEN** 系统 MUST 向用户说明本次操作是更新已有 skill
- **AND** 若目标为其他用户的 `PRIVATE` skill，系统 MUST 拒绝覆盖
