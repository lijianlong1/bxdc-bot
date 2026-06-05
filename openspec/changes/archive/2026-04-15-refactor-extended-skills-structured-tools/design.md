## Context

- 扩展 Skill 由 SkillGateway 持久化，`agent-core` 的 `loadGatewayExtendedTools` 拉取后注册为 LangChain 工具。
- 当前实现普遍使用 `DynamicTool`，对外仅 `input: string`；API 类依赖 `parameterContract`（JSON Schema）+ Ajv 在执行路径校验；SSH 类使用 `executeServerResourceStatusSkill` 且对 `input` 做 `JSON.parse`，与模型实际传入的扁平参数、裸别名不兼容。
- 内置 `server_lookup`、`ssh_executor` 等已使用 `DynamicStructuredTool` + Zod，扩展 Skill 与之内外不一致。

## Goals / Non-Goals

**Goals:**

- 所有网关扩展 Skill 以 **`DynamicStructuredTool`** 注册，**Zod** 作为工具入参 schema 的来源（手写或从 `parameterContract` / 固定模板动态生成）。
- 提升 LLM **function calling** 的参数质量：顶层字段、类型明确，减少字符串套 JSON。
- **Skill 生成器**（`JavaSkillGeneratorTool` / `buildGeneratedSkill`）产出与运行时工具形态一致的配置（含 SSH 台账字段约定、API 的 `parameterContract`）。
- **确认流**（`extended_skill_confirmation`）与 `buildConfirmedToolInputString` / `toolCall.args` 兼容结构化参数。

**Non-Goals:**

- 本次不强制移除 **Ajv**；是否以 JSON Schema 为唯一真理、Zod 仅由契约派生，见下文 **Decisions**。
- 不修改 SkillGateway **HTTP API** 的 Skill CRUD 形状（除非实现中发现必须增加字段，另开任务）。
- 不要求前端必须改版；若仅文案同步，作为可选 follow-up。

## Decisions

1. **统一工具形态：DynamicStructuredTool**  
   - **Rationale**：与内置工具一致，利用 OpenAI/LangChain 的 `parameters` 描述，减少嵌套编码错误。  
   - **Alternatives**：保留 `DynamicTool` + 更强 `parseToolInput`（拒绝：无法根治 LLM 侧字段形态）。

2. **Zod 的生成策略**  
   - **API**：优先 **从 `parameterContract`（JSON Schema）在加载时生成 Zod**（选用成熟转换库或受控子集映射）；若短期成本过高，可采用 **宽松 Zod（如 `z.record`）+ 执行路径仍用 Ajv 严格校验**，再迭代为严格 Zod。  
   - **SSH（server-resource-status）**：固定 **`z.object({ name: z.string().min(1) })`**（或 `serverName` 与 `name` 二选一，与台账 lookup 一致），**禁止**在 tool 参数中暴露 `command`。  
   - **Template / OPENCLAW**：按现有执行分支定义最小 Zod（如 template 可选 `input` 字符串）。  
   - **Rationale**：每 Skill 独立 tool 实例，schema 可每实例不同。

3. **Ajv 与 Zod 的分工**  
   - **决策**：以数据库中的 **`parameterContract`（JSON Schema）为 API Skill 的权威契约**；执行前对 **合并默认值后的 payload** 继续 **Ajv** 校验（与现行为一致）。  
   - **Zod** 负责 **工具边界**：与发给 LLM 的 parameters 一致，避免明显类型错误。  
   - **Alternatives**：仅 Zod、丢弃 Ajv（需将 JSON Schema 完整转为 Zod 并长期同步，成本高）；仅 Ajv、不用 Zod（则无法用 `DynamicStructuredTool` 标准绑定，需查 LangChain 是否支持纯 JSON Schema tool，维护面不同）。

4. **`executeServerResourceStatusSkill` 入参**  
   - 改为接受 **结构化对象** 或内部将 args 序列化为稳定 JSON，**不再**对裸别名执行 `JSON.parse`；**command** 仅 `config.command`。

5. **Skill 生成器**  
   - SSH：生成配置中可增加 **`inputSchema` 或文档化字段说明**（若 design 采用固定 Zod，则生成器只需保证 `kind`/`preset`/`command` 与现有一致，并在工具描述中固定「台账别名字段名」）。  
   - API：确保 `parameterContract` 可被加载逻辑用于 **生成 Zod + Ajv**（同源）。

6. **Agent 系统提示**  
   - 更新 `AGENT_EXTENDED_SKILL_ROUTING_POLICY` 等描述：扩展 API Skill 使用 **结构化顶层参数**，不再强调单一 `input` 信封（与 `api-extension-skill-llm-tool-call` delta 一致）。

7. **取消 `REQUIRE_PARAMETERS` 与渐进披露**  
   - **决策**：不再对 API 扩展 Skill 执行「空入参 → 返回契约 + 要求第二次调用」的渐进披露路径。  
   - 工具描述与（可选）`interfaceDescription` / `parameterContract` 摘要 **一次性暴露全量** 参数与 Skill 能力说明，由模型在单次调用中填齐；缺字段时由 **Zod**（工具边界）与 **Ajv**（合并后）返回错误即可。  
   - **Rationale**：StructuredTool 已给出完整 `parameters`，渐进披露价值下降；减少分支与重试循环。  
   - **实现**：移除或简化 `hasApiProgressiveDisclosureMaterial`、`isEmptyApiToolInput` 触发的 `REQUIRE_PARAMETERS` 分支；相关 spec delta 需同步删除「第二次调用必须带 `input` 信封」类要求。

8. **普通用户会话隐藏 `ssh_executor`**  
   - **决策**：在**默认 / 普通用户**对话会话中，**不向 LLM 绑定**内置 `ssh_executor` 工具；远程命令执行仅通过 **扩展 SSH 类 Skill**（其内部由 agent-core 走 `executeServerResourceStatusSkill` → gateway `/api/skills/ssh`，等价于受控的 `command` + 台账解析）。  
   - **例外**（可选，由实现定）：管理员、调试模式、或显式环境变量 `ALLOW_SSH_EXECUTOR=1` 仍可挂载 `ssh_executor`，便于排障。  
   - **Rationale**：与「命令只来自存库、模型只选 Skill」一致，防止模型绕过扩展 Skill 随意拼 shell。  
   - **注意**：扩展 SSH Skill 的执行路径**仍调用**同一 gateway SSH 能力，**不是**禁止 SSH，而是禁止**裸 `ssh_executor` tool** 暴露给模型。

## Risks / Trade-offs

- **[Risk]** JSON Schema → Zod 转换不完整 → Zod 与 Ajv 行为不一致。  
  **→ Mitigation**：过渡期宽松 Zod + Ajv 为准；契约子集手写映射；单测对照典型 `parameterContract`。
- **[Risk]** 工具数量多导致 prompt 上下文增大。  
  **→ Mitigation**：与现有一致（每 Skill 一 tool）；必要时后续做 Skill 分页/筛选（非本变更范围）。
- **[Risk]** 确认流、重试路径参数丢失。  
  **→ Mitigation**：用结构化 `args` 序列化回归测试覆盖 `interrupt` / `resume`。

## Migration Plan

1. 实现新注册路径与执行路径，在开发环境用现有 Skill 数据回归。  
2. 更新单测与 agent 集成测试。  
3. 部署 agent-core；网关与 DB **无强制迁移**（配置兼容）。  
4. **Rollback**：回退 agent-core 发布；旧版仍可用 `DynamicTool` 行为若保留 feature flag（可选，由实现决定）。

## Open Questions（已决）

| 问题 | 结论 |
|------|------|
| JSON Schema → Zod 是否引入新依赖及版本锁定 | 实现阶段选定：若采用转换库则锁定 `package.json` 主版本；若过渡期宽松 Zod + Ajv，可延后引入。 |
| `REQUIRE_PARAMETERS` / 渐进披露 | **取消**。全量暴露 parameters 与 Skill 说明；缺参由 Zod/Ajv 报错。见 **Decisions 7**。 |
| 普通用户是否隐藏 `ssh_executor` | **是**。默认会话不绑定 `ssh_executor`；仅通过扩展 SSH 类 Skill 间接使用网关 SSH；可选管理员/调试例外。见 **Decisions 8**。 |
