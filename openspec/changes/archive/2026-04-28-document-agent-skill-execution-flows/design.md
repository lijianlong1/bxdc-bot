## Context

Agent 运行时工具链在 `backend/agent-core/src/agent/agent.ts` 中组装：先注册一组 **built-in** 工具（含 `skill_generator`、条件暴露的 `ssh_executor` 等），再异步加载 Skill Gateway 上类型为 `EXTENSION` 的 skill，映射为 `DynamicStructuredTool`。具体分支（API 经 Gateway 代理、OPENCLAW 内层 planner、`server-resource-status` 类 SSH 经 `/api/skills/ssh` 等）集中在 `backend/agent-core/src/tools/java-skills.ts`。`agent.controller.ts` 中的扩展 Skill 路由策略文案影响模型选型，但不改变代码路径。本变更需在 `docs/` 产出读者向说明，并与上述实现一致。

## Goals / Non-Goals

**Goals:**

- 约定**单一主文档**路径与命名，集中描述工具装配、扩展加载、各 skill 类型的数据流与关键 HTTP/headers。
- 使用 **Mermaid**（flowchart / sequenceDiagram）表达主要路径，便于在 GitHub/Cursor 中渲染。
- 明确 **built-in** 与 **extended** 的边界、OPENCLAW 子工具白名单与 `plannerModel.bindTools` 行为、API skill 走 Gateway `/api/skills/api` 代理的 payload 形状。

**Non-Goals:**

- 不重写 Skill Gateway Java 实现细节（仅引用与 agent 交互的 REST 路径）。
- 不将本设计作为产品行为变更的权威规格（行为仍以 `openspec/specs/` 下既有能力为准）。

## Decisions

1. **主文档路径**  
   - **决定**：`docs/agent-skill-execution-flows.md` 作为唯一入口；若章节过长，可将「环境变量与策略附录」列为同目录可选小节或同一文件内二级标题。  
   - **理由**：与 `docs/skill-gateway-mysql.md` 等现有文档并列，便于发现。  
   - **备选**：按类型拆多文件；会增加交叉引用维护成本，本次不采用。

2. **流程图粒度**  
   - **决定**：至少包含：(1) `AgentFactory.createAgent` 工具列表与顺序；(2) `loadGatewayExtendedTools` 从列表到 `func` 分支；(3) `executeOpenClawSkill` 串行 planner 循环；(4) API 与 SSH（built-in `ssh_executor` vs extended `server-resource-status`）两条链路的对比。  
   - **理由**：与用户请求的四类路径一一对应。

3. **事实来源**  
   - **决定**：文中引用代码路径与关键符号名（英文），避免臆测；对「仅策略层」的说明标注为 LLM 提示词约束。  
   - **理由**：文档可随代码演进校验。

## Risks / Trade-offs

- **文档与代码漂移** → 在 spec 中要求文档标注「主要实现文件」列表；重大行为变更时应同步更新本文档或拆任务跟进。  
- **Mermaid 在部分查看器中渲染差异** → 使用标准 flowchart/sequenceDiagram 语法，避免复杂样式。

## Migration Plan

（不适用）本变更为新增文档与 OpenSpec 工件，无部署迁移。

## Open Questions

- 若未来 extended SSH 支持更多 `preset` 而非仅 `server-resource-status`，需在 `java-skills` 分支与文档中同步扩展。当前以代码为准。
