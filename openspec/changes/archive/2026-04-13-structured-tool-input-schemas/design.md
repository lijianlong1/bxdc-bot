## Context

- **现状**：`JavaComputeTool` 已使用 `DynamicStructuredTool` 与 `computeToolInputSchema`（Zod），模型直接输出 `operation`、`operands` 等字段，网关收到 `{ operation, operands }`。
- **现状**：`JavaSshTool`、`JavaApiTool`、`JavaLinuxScriptTool`、`JavaServerLookupTool`、`JavaSkillGeneratorTool` 等仍继承 `Tool`，`_call(input: string)` 内 `JSON.parse`；暴露给模型的 OpenAPI function 多为单参数 `input: string`（见各厂商 tool 绑定行为）。
- **约束**：Java Skill Gateway 各 `/api/skills/*` 的请求体格式不变；优化仅限于 **LangChain 工具层** 的入参建模与校验。

## Goals / Non-Goals

**Goals:**

- 内置工具与 `skill_generator` 使用 **Zod schema** 生成 JSON Schema，供模型做 **结构化 function calling**。
- 在 `func`/`_call` 执行前由 LangChain/Zod **拒绝**明显非法参数，返回可读错误（或落入现有 `formatToolError` 风格），减少「半合法 JSON 字符串」导致的静默 `{}` 解析。
- 为 `skill_generator` 提供 **按 `targetType` 分支的 schema**（api / ssh / openclaw / template），必填项在 schema 层可见。

**Non-Goals:**

- 不改变 Gateway Java API 的 URL、鉴权头、请求体业务字段含义。
- 不在本阶段重写 extension 技能的 `DynamicTool` 加载逻辑（其 schema 来自网关配置）。
- 不要求一次性改完所有工具；允许分 PR 按工具迁移，但 tasks 中列出完整清单。

## Decisions

1. **统一使用 `DynamicStructuredTool` + Zod**  
   **原因**：与 `compute` 一致，可复用 `.describe()` 生成模型可读说明；`zodToJsonSchema` 若未直接使用，LangChain 对 `ZodObject` 已有支持。  
   **备选**：手写 JSON Schema + `StructuredTool`——重复、易与实现脱节。

2. **每工具一个 `z.object`（或 discriminated union），字段名对齐网关 JSON**  
   **原因**：`func` 内直接 `axios.post(url, args)` 或浅层组装，减少「再 parse 一层」；与现有 `parseToolInput` 解耦。  
   **备选**：保留单字符串 `input` 仅加服务端校验——不改善模型侧。

3. **`skill_generator` 使用 `z.discriminatedUnion('targetType', [...])` 或 `z.union` + `superRefine`**  
   **原因**：不同 `targetType` 必填字段不同；单一大 object 全 optional 会继续诱导模型漏字段。  
   **备选**：仅文档加长——不可执行、不可测试。

4. **迁移顺序（建议）**：`server_lookup`（字段少）→ `linux_script_executor` → `api_caller` → `ssh_executor`（字段多、敏感）→ `skill_generator`（最复杂）。  
   **原因**：先验证模式再扩到高风险的 SSH 与多分支生成器。

5. **兼容与日志**：`tool_trace` / `sanitizeToolTraceArguments` 已接受 object；若某处假定 arguments 为「从字符串 parse」，需改为接受结构化对象。

## Risks / Trade-offs

- **[Risk] 模型旧习惯仍输出字符串** → 新 schema 无 `input` 字段后，错误会前置为「参数校验失败」；可在 description 中明确「勿再传入单一 JSON 字符串」。  
- **[Risk] 不同 LLM 对复杂 union schema 支持不一** → Mitigation：对 `skill_generator` 可保留较扁的结构 + `targetType` 必填，其余用 optional + 服务端 `INPUT_INCOMPLETE` 兜底（已有）。  
- **[Trade-off] 代码量上升** → 换更可维护的调用成功率与可测性。

## Migration Plan

1. 按 tasks 逐工具合并；每步跑通 `agent-core` 编译与一次手动对话（含工具调用）。
2. 回滚：单工具回退为 `Tool` + string（保留 git 历史）。

## Open Questions

- 是否在 CI 中为各 Zod schema 增加「快照 JSON Schema」测试（可选）。
- `skill_generator` 的 `parameterContract` 等大块字段是否用 `z.record`/`z.any()` 放宽以适配任意 API 技能（需与产品确认）。
