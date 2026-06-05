# agent-structured-tool-input（delta）

## ADDED Requirements

### Requirement: 内置工具向模型暴露结构化入参

Agent Core 中由本仓库实现的内置工具（非网关注册 extension 技能）SHALL 通过带类型约束的入参模型（以 Zod 等效 JSON Schema 形式绑定到 LangChain `StructuredTool` 族）向大模型暴露参数，SHALL NOT 仅依赖单一字符串属性承载整段 JSON 作为唯一调用方式。

#### Scenario: 工具参数为多个具名字段

- **WHEN** 模型发起对某一内置工具的 function call
- **THEN** 该工具在提供商可见的 function parameters 中 SHALL 包含与网关请求语义对应的多个属性（例如布尔、数值、字符串数组等），而非仅 `input: string`
- **AND** Agent Core SHALL 在执行网关请求前使用同一套结构进行校验或映射

#### Scenario: 校验失败行为可诊断

- **WHEN** 模型提交的参数不满足 schema（缺必填、类型错误）
- **THEN** 调用 SHALL 失败或返回明确错误信息
- **AND** SHALL NOT 将非法输入静默解析为空对象并当作成功路径继续

### Requirement: skill_generator 使用按类型的结构化入参

`skill_generator` 工具 SHALL 使用能够区分 `targetType`（api、ssh、openclaw、template 等）的入参 schema，使各类型所需字段在 schema 层可区分；SHALL 在执行 `buildGeneratedSkill` 前得到已校验的结构化对象。

#### Scenario: 不同 skill 类型字段要求不同

- **WHEN** `targetType` 为 `api`
- **THEN** schema SHALL 允许或要求与 API 技能创建相关的字段（如 endpoint、method、interfaceDescription 等）按约定出现
- **WHEN** `targetType` 为 `template`
- **THEN** schema SHALL 与 api 类型字段集可区分（例如强调 `prompt`），避免全部扁平为可选字符串导致模型漏填

#### Scenario: 与现有不完整输入响应兼容

- **WHEN** 校验通过但业务层仍缺字段（`buildGeneratedSkill` 返回 `missingFields`）
- **THEN** 系统 SHALL 继续返回现有的 `INPUT_INCOMPLETE` 风格响应
- **AND** SHALL NOT 因引入 Zod 而删除该渐进式补全流程
