# api-skill-generation Specification

## Purpose
TBD - created by archiving change generate-api-skill-from-description. Update Purpose after archive.
## Requirements
### Requirement: Agent can generate API skill from user description
系统 SHALL 支持一个 built-in skill，根据用户输入的 API 描述生成一条符合当前 Extended Skill 标准的 API 类型 skill 数据，生成结果至少包含 `name`、`description`、`type`、`configuration`、`enabled` 与 `requiresConfirmation`。

#### Scenario: Generate skill payload from complete API description
- **WHEN** 用户提供了完整的 API 描述，包含接口地址、请求方法、必填参数或鉴权信息
- **THEN** 系统生成一条 `type=EXTENSION` 的 skill 数据
- **THEN** 生成的 `configuration` MUST 符合当前 API 类型 skill 的执行协议
- **THEN** 系统返回推荐的 skill 名称、用途描述和验证输入

#### Scenario: Reject incomplete API description
- **WHEN** 用户提供的 API 描述缺少关键执行信息，例如接口地址、请求方法或必填鉴权字段
- **THEN** 系统 MUST 不创建 skill
- **THEN** 系统 MUST 明确指出缺失字段并要求用户补充

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

### Requirement: System validates generated skill immediately after save
系统 SHALL 在 API skill 保存成功后，自动执行一次新生成的 skill，验证其是否可用，并将验证结果返回给用户。

#### Scenario: Validation succeeds after skill creation
- **WHEN** 新生成的 skill 已成功保存且验证输入可执行
- **THEN** 系统 MUST 调用该 skill 一次
- **THEN** 系统 MUST 返回验证成功结果与关键响应摘要

#### Scenario: Validation fails after skill creation
- **WHEN** skill 已成功保存但首次验证调用失败
- **THEN** 系统 MUST 向用户返回失败原因
- **THEN** 系统 MUST 保留已保存的 skill 记录，除非用户明确要求回滚

### Requirement: System provides operator-friendly failure feedback
系统 SHALL 在生成、保存、验证任一环节失败时返回结构化且可操作的反馈，帮助用户修正 API 描述或请求配置。

#### Scenario: External API returns error during validation
- **WHEN** 首次验证时外部 API 返回错误码、鉴权失败或格式错误响应
- **THEN** 系统 MUST 报告失败发生在验证阶段
- **THEN** 系统 MUST 展示与调试相关的关键上下文，例如请求参数摘要或返回错误信息

#### Scenario: Generated description is not suitable for later model routing
- **WHEN** 系统无法从原始 API 描述中提炼出清晰的 skill 用途说明
- **THEN** 系统 MUST 提示该 description 不足以支持后续模型调用判断
- **THEN** 系统 MUST 要求用户确认或补充更明确的用途描述

