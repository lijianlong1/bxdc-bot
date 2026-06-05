# api-parameter-validation（delta）

本文件为对 `openspec/specs/api-parameter-validation/spec.md` 的变更增量；归档后合并入主 spec。

## ADDED Requirements

### Requirement: API 扩展 Skill 分层校验（Zod 与 Ajv）

对扩展 **API** Skill，系统 SHALL 采用 **分层校验**：

1. **工具边界**：使用 **Zod**（由 `parameterContract` 动态生成或与契约同源的 schema）解析并约束 LLM 的 **tool call** 参数。
2. **业务执行前**：在合并默认值等逻辑之后，继续使用 **Ajv** 对 **`parameterContract`（JSON Schema）** 校验合并后的 payload。

若 Zod 与 JSON Schema 在过渡期存在表达力差异，**以 Ajv 对合并后 payload 的校验为最终 gate**；工具边界错误与契约错误均 MUST 以结构化错误返回给 LLM 以支持纠错。

#### Scenario: 仅 Zod 失败

- **WHEN** LLM 提供的 tool 参数无法通过 Zod 解析（类型错误、缺字段等）
- **THEN** 系统 MUST NOT 进入 Ajv 合并路径或 HTTP 执行
- **AND** MUST 返回与工具层一致的错误信息

#### Scenario: Zod 通过但 Ajv 失败

- **WHEN** tool 参数通过 Zod，但合并后的对象不符合 `parameterContract`
- **THEN** 系统 MUST NOT 执行 API 请求
- **AND** MUST 返回与现有 Ajv 校验一致的错误详情（字段名、类型、enum 等）

#### Scenario: 两层均通过

- **WHEN** Zod 与 Ajv 均通过
- **THEN** 系统 MUST 执行 API 请求
