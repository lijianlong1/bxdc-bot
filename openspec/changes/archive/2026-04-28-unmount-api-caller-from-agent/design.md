## Context

当前 `AgentFactory` 在装配工具时**无条件**注册 `JavaApiTool`（`name: "api_caller"`），出站到 Skill Gateway 时根据 `AGENT_BUILTIN_SKILL_DISPATCH` 选择 `POST /api/skills/api` 或 `POST /api/system-skills/execute`（`toolName: "api_caller"`）。  
扩展 **API** 类 Skill 则在 `loadGatewayExtendedTools` 所注册的 `DynamicStructuredTool` 的 `func` 内调用 `executeConfiguredApiSkill`，**始终** 使用 `POST {gatewayUrl}/api/skills/api` 发送已合并的 `url` / `method` / `headers` / `body`，**不** 经过名为 `api_caller` 的 LangChain 工具。  
`docs/agent-skill-execution-flows.md` 已有叙述，但 **OpenSpec 层** 缺少与代码路径一一对应的 SHALL，易导致「扩展 = 调 `api_caller`」的误解。

## Goals / Non-Goals

**Goals:**

- 默认 Agent **不向 LLM 暴露** `api_caller` 工具，推动「受控的扩展 API Skill」为唯一主路径（与产品提示中「优先扩展」一致）。
- **保留** `JavaApiTool` 类及其实现，便于以后通过环境变量/配置恢复或给内部调试脚本使用，并在类与注册点用**中文注释**标明 **暂时不默认挂载**。
- 在 `api-skill-invocation` 的 delta 中 **规范化** 扩展 API Skill 的 Agent→Gateway 路线描述，与 built-in 区分。

**Non-Goals:**

- 不在本变更中删除 Gateway `system_skills` 的 `api_caller` 种子或 `SystemSkillService` 的 `API_PROXY` 分支（除非后续单独变更）。
- 不强制改造 `AGENT_BUILTIN_SKILL_DISPATCH` 语义；`JavaApiTool` 未注册时该开关对 API 无实际影响。

## Decisions

1. **以「不注册」为默认，而非删类**  
   - **Rationale**：满足「取消挂载、代码保留、注释说明」；回滚/灰度时只需恢复 `new JavaApiTool(...)` 一行。  
   - **Alternatives considered**：`if (env.ENABLE_API_CALLER)` 注册——可后续加，本变更先采用「注释 + 删除注册行」降低分支复杂度。

2. **Spec 采用「ADDED」要求** 写清路线，不修改 `api-skill-invocation` 中现有校验/绑定条款  
   - **Rationale**：减少 archive 时误伤既有全文 MODIFIED 块的风险。

3. **提示词**（`en.ts` / `zh.ts`）中与 `api_caller` 相关的「不要绕过扩展」列表  
   - 若已完全不挂载，应 **更新句式**，避免仍暗示模型**可用** `api_caller`（可改为列其余内置，或注「本部署未暴露 api_caller」）。实现任务中明确检查。

## Risks / Trade-offs

- **[Risk] 运营/用户依赖「让模型随便调一个 URL」**  
  - **Mitigation**：本变更在 proposal 中标记行为级 BREAKING；若需要，可后续增加仅运维可见的显式开关再挂载。

- **[Risk] 测试或脚本仍 `import` 并实例化 `JavaApiTool`**  
  - **Mitigation**：单测可继续构造 `JavaApiTool` 测 Gateway 行为；E2E 不依赖「默认 agent 带 api_caller」。

- **[Trade-off] `system_skills` 中 `api_caller` 仍存在**  
  - 无 Agent 调用时该记录闲置；与「删除内置 skill 记录」的治理可在 Gateway 侧单独开变更。

## Migration Plan

1. 实现：去注册 + 注释 + spec + 提示词/文档小同步。  
2. 发布：无数据迁移。  
3. 回滚：恢复 `agent.ts` 中 `new JavaApiTool` 与提示词原句即可。

## Open Questions

- 是否需要在 `AGENT_ALLOW_BUILTIN_API_CALLER=true` 一类开关下恢复挂载？**本设计不强制**；若产品需要，可在 `tasks` 中列为可选 follow-up。
