## Why

贡献者与运维需要一份**单一、可追溯**的说明，描述 Agent 在任务执行过程中如何加载与调用各类 Skill（内置生成器、Gateway 扩展 API、SSH、OPENCLAW 自主规划），以及数据在 `agent-core`、Skill Gateway、确认流之间的走向。当前逻辑分散在 `java-skills.ts`、`agent.ts` 与策略文案中，缺少面向读者的文档与流程图，增加理解与排障成本。

## What Changes

- 在 `docs/` 下新增一份（或主文档 + 可选附录）**中文技术文档**，系统化梳理上述路径，并配以 **Mermaid 流程图**（与代码行为一致，随实现更新）。
- 文档内容覆盖：`AgentFactory` 工具装配顺序、扩展 Skill 从 Gateway 列表到 `DynamicStructuredTool` 的分支（API 代理、SSH 预设、template、OPENCLAW）、`skill_generator` 保存与后续调用关系、内置 `ssh_executor` 的暴露条件与扩展 SSH 的优先级策略引用。
- **不**改变运行时行为；若发现与文档不一致的代码问题，仅在变更的 `tasks.md` 中记录为可选跟进项，本变更以文档交付为主。

## Capabilities

### New Capabilities

- `agent-skill-execution-documentation`：定义「Agent Skill 执行流程说明」文档应包含的章节、流程图类型与须引用的关键模块/环境变量，作为文档交付的验收标准。

### Modified Capabilities

- （无）本变更为文档与说明性交付，不修改既有 OpenSpec 行为规格。

## Impact

- **受影响路径**：`docs/` 新增文件；`openspec/changes/document-agent-skill-execution-flows/` 下的 proposal、design、specs、tasks。
- **代码**：以阅读与引用为主；默认不修改 `backend/agent-core`（除非 tasks 中明确列为可选修正且单独评审）。
- **依赖**：文档须与当前 `backend/agent-core/src/agent/agent.ts`、`backend/agent-core/src/tools/java-skills.ts` 及 Gateway API 行为对齐。
