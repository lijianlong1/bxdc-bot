## Why

接入部分模型时，对话里会同时出现「历史里的旧任务描述」和「当前轮次新任务」；仅靠 `messages` 堆叠时，模型难以稳定判断哪一条才是**此刻要执行**的工作，容易重复已完成步骤或忽略新指令。需要在 LangGraph 状态里引入**显式的任务完成记录**，让路由与提示有据可依。

## What Changes

- 在 Agent 的 LangGraph **State** 中增加 **`tasks_status`**（或等效命名），用于记录**独立任务**及其完成状态（例如「待处理 / 进行中 / 已完成」）。
- 在**执行任务**的节点路径上（例如工具调用完成、或某子目标达成后），**写回** `tasks_status`，将对应项标记为已完成。
- 在**路由函数**或**下一节点注入的 prompt / system 片段**中读取 `tasks_status`：对已标记完成的项不再要求模型重复执行；引导模型聚焦**未完成**任务。
- 若当前实现使用 `createReactAgent` 等预构建图，需评估通过 **state schema 扩展**或**自定义图**接入该字段；具体见 `design.md`。

## Capabilities

### New Capabilities

- `agent-tasks-status`: LangGraph 侧任务状态字段 `tasks_status` 的结构、更新时机、以及在决策与提示中的使用约束。

### Modified Capabilities

- （无）本变更以 Agent Core 图状态与行为为主；若后续将 `tasks_status` 通过 SSE 暴露给前端，可另开变更修改 `agent-client` 等规范。

## Impact

- **后端**：`backend/agent-core` 中 `AgentFactory` / LangGraph 图定义、可能与 `agent.controller` 流式事件组装相关。
- **依赖**：`@langchain/langgraph` 预构建 ReAct 与自定义 `StateGraph` 的选型。
- **前端**：本提案阶段不要求；可选后续在聊天 UI 展示任务进度。
