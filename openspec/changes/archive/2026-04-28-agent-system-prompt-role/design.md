## Context

- 当前 `agent.controller.ts` 中 `fullInstruction` 将 `skillContext`、四条策略、`memoryContext` 与 `User Instruction:\n${instruction}` 拼为**单条 user 消息**内容，模型未收到独立 **system** 层的身份说明。
- `preModelHook`（`tasks-state.ts`）在存在任务摘要时，将 **`SystemMessage`（任务状态）** 插入 `llmInputMessages` 最前，**已存在** system 类消息，但仅覆盖任务跟踪，覆盖全局角色。
- 提示语言由 **`AGENT_PROMPTS_LANGUAGE`**（`zh` / `en`）在 `prompts/index.ts` 中切换，英文为无效值与默认回退。

## Goals / Non-Goals

**Goals:**

- 为 Agent 提供稳定、可维护的 **角色与职责** 文案，并与现有 **四条策略** 一起在 **system 角色** 中呈现（与 `Prompts` 语言一致）。
- 将 **随请求变化** 的片段保留在 user：如 `buildSkillPromptContext()` 产出、`memory` 检索结果、用户本次 `instruction` 标签与正文。
- 明确 **与 `preModelHook` 的 SystemMessage 顺序** 及多段 system 的兼容性结论，避免与 LangGraph / 供应商行为冲突。

**Non-Goals:**

- 不引入第三种自然语言资源文件；延续现有 `zh` + `en` 双份实现。
- 不修改 OpenSpec 其他子系统（Gateway、前端）的接口契约。
- 不在本变更中重做「策略全文措辞」大改，仅做必要结构调整以配合分层。

## Decisions

1. **新增 `SystemPrompts` 字段**（例如 `agentRolePrompt: string`）  
   - **理由**：与 `skillGeneratorPolicy` 等并列，由 `zh.ts` / `en.ts` 各写一份，保证双语对称；`types.ts` 扩展接口，`Proxy` 出口自动可用。

2. **静态 system 内容拼接顺序**  
   - 建议顺序：**`agentRolePrompt` → 四条 policy（与现 controller 中顺序一致：skill 生成、扩展路由、任务跟踪、确认）**。  
   - **理由**：先身份与使命，后操作性策略；与当前用户可见逻辑顺序一致，便于 diff。

3. **`runTask` 中 `messages` 形状**  
   - 在 **`validHistory` 之前** 插入**一条** `{ role: "system", content: staticSystemPrompt }`（`staticSystemPrompt` 为上述拼接结果）。  
   - **user 消息**仅含：`skillContext` + `memoryContext` + `User Instruction:\n` + `instruction`（**不再**重复四条 policy 字符串）。  
   - **理由**：动态技能列表与记忆、本轮指令自然落在 user；策略与身份进 system。

4. **与 preModelHook 的叠放**  
   - `preModelHook` 在有任务摘要时 **unshift** 至 `llmInputMessages[0]`。  
   - **决策**：保持现有 hook 行为不变；若运行时顺序为 `[任务摘要 system, 静态 system, history, user]`，对多数 OpenAI 兼容端点可接受。若某部署验证「多 system 顺序敏感」，可在后续小变更中将任务摘要改为注入 user 前缀或合并进单一 system（列为风险缓解）。本设计 **不** 强制 first-time 改 hook。

5. **环境变量与可配置**  
   - 首版 **不** 将 `agentRolePrompt` 从 env 覆写；若需白标部署，后续可加 `AGENT_SYSTEM_PROMPT_PREFIX` 等。本变更只落地代码内双语资源。

## Risks / Trade-offs

- **[Risk] 部分 LLM 对多段 `system` 合并行为不一致**  
  - **缓解**：在 `tasks.md` 中列出手动/自动化回归用例；若发现问题，可改为「单条 system 内用 `\n\n` 拼接任务摘要（需改 hook）」或「任务摘要改 user 前缀」。

- **[Risk] system 变长导致 token 增加**  
  - **缓解**：角色段落保持短段落（建议 ≤ 1k 中文字符等量级由实现控制）；与原先全部挤在 user 相比总量相近，仅角色块为新增长。

- **[Trade-off] 历史对话中不 retroactive 插入 system**  
  - `validHistory` 仅含 user/assistant/system（若客户端曾存）；本次仅在**当轮**首条前插入静态 system，符合常见「每轮带系统提示」的 streaming 行为。

## Migration Plan

- 无数据迁移；部署后设 `AGENT_PROMPTS_LANGUAGE` 的现有环境**行为增强**，无需 DBA。  
- 回滚：恢复 `agent.controller` 为单条 user 全量拼接并移除 `agentRolePrompt` 引用即可。

## Open Questions

- 是否需要在后续版本将 `fullInstruction` 拆成「system + 两条 user（context vs instruction）」以进一步分离；本变更不执行。
