## Context

当前 `AgentFactory` 使用 `@langchain/langgraph/prebuilt` 的 `createReactAgent`，状态以 **`messages`** 为主通道，无独立「任务」生命周期字段。多轮对话 + 工具 ReAct 时，模型仅依赖消息文本区分「旧任务」与「新任务」不可靠。

## Goals / Non-Goals

**Goals:**

- 在图 State 中持久化 **`tasks_status`**，使「哪些子任务已做完」与对话文本解耦。
- 在工具执行完成（或明确子目标完成）时**更新**对应任务状态。
- 让**路由或 LLM 前置上下文**能读取该状态，减少重复劳动与指令歧义。

**Non-Goals:**

- 不在本阶段规定前端必须展示任务列表（可后续扩展）。
- 不强制统一全站「任务」自然语言解析器；任务边界可由产品约定（显式列表、Planner 输出、或用户消息分段策略）。

## Decisions

1. **State 形状（建议）**  
   - `tasks_status`: 建议使用 **任务 id → 状态** 的映射，例如 `Record<string, TaskState>`，`TaskState` 至少包含 `status: 'pending' | 'in_progress' | 'completed' | 'cancelled'` 与可选 `label`、`updatedAt`。  
   - **理由**：映射便于按键更新、合并写回；列表结构需额外查重。

2. **与预构建 `createReactAgent` 的关系**  
   - **方案 A**：若所用版本支持向预构建 Agent 传入 **扩展 state schema**（`Annotation` + 自定义 reducer），则优先在**不 fork 全图**的前提下挂载 `tasks_status`。  
   - **方案 B**：若无法扩展，则引入 **自定义 `StateGraph`**：复用 ReAct 子图或拆解为 `agent` / `tools` 节点，在 `tools` 节点后增加**状态更新**步骤。  
   - **理由**：以可维护性为先；需查阅当前 `@langchain/langgraph` 版本 API 做二选一。

3. **何时写入「已完成」**  
   - 默认：在 **ToolMessage 成功落账**（或等价「工具执行节点结束」）后，将**当前轮次关联的任务 id** 标为 `completed`；若工具失败可标 `pending` 或记录错误子状态（可选）。  
   - 若任务由**纯文本回复**完成（无工具），需在 **agent 节点**根据策略（如结构化输出、或显式 task id）写状态——列为实现期细化项。

4. **决策与提示**  
   - **路由**：条件边可根据 `tasks_status` 跳过重复工具分支（若业务定义清晰）。  
   - **Prompt**：在调用 LLM 前拼接**短摘要**（例如「已完成：…；待处理：…」），**禁止**仅依赖长历史消息。  
   - **理由**：与用户需求「有据可依」一致。

## Risks / Trade-offs

- [预构建 API 限制] → 若无法扩展 state，自定义图工作量上升；**缓解**：先查文档与版本，再定方案 B。  
- [任务 id 来源] → 若无显式 id，需约定从用户消息或 Planner 生成稳定 id；**缓解**：首版可用 `session` 内递增 id + 简短描述。  
- [状态与 checkpoint] → 持久化会话时需确认 `tasks_status` 随 checkpoint 保存；**缓解**：将字段纳入 `StateAnnotation` 的 reducer。

## Migration Plan

1. 实现后在现有 E2E / 手工用例中验证：多轮「先 A 后 B」指令下，B 不被旧 A 干扰。  
2. 回滚：移除字段与节点写回，恢复纯 `messages` ReAct（功能回退、无数据迁移风险若未落库）。

## Open Questions

- 任务列表的**初始来源**：仅用户最新一条、还是系统 Planner 拆解？需与产品确认。  
- 是否将 `tasks_status` **透出到 SSE** 供前端展示：本阶段不阻塞，可单列变更。
