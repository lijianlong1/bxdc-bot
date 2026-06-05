## 1. 调研与方案定型

- [x] 1.1 查阅当前 `@langchain/langgraph` 与 `createReactAgent` 是否支持扩展 State（`Annotation` / `stateSchema`）
- [x] 1.2 在 1.1 结论基础上选定：`createReactAgent` 扩展 vs 自定义 `StateGraph`（见 design 决策 2）

## 2. State 与类型

- [x] 2.1 定义 `tasks_status` 的 TypeScript 类型（任务 id、状态枚举、可选元数据）
- [x] 2.2 将 `tasks_status` 纳入图 State 定义，并配置合适的 reducer（默认 `replace` 或自定义 merge）

## 3. 运行时写回

- [x] 3.1 在工具执行成功路径（或统一 tools 节点后）将关联任务标记为已完成
- [x] 3.2 约定「任务 id」来源（用户消息、Planner、或会话内生成）并在首版实现最小闭环

## 4. 决策与提示

- [x] 4.1 在调用 LLM 前注入 `tasks_status` 摘要或结构化片段到 system / 前置消息
- [x] 4.2 若有条件路由，基于 `tasks_status` 跳过无需重复的边（可选，按产品需要）

## 5. 验证与文档

- [x] 5.1 增加或可重复执行的集成/手工场景：多任务顺序与「已完成不重复」行为
- [x] 5.2 更新 `docs/ARCHITECTURE.md` 或 Agent 相关说明中关于图状态的一节（若仓库惯例要求）
