## Context

- 前端 `useChat` 已区分 `tool_status` 事件与 LLM 日志事件，并分别写入同一条 assistant 消息的 `toolInvocations` 与 `llmLogs`。
- `MessageList.vue` 中「调用日志」弹窗先 `v-for` 渲染全部 `activeToolInvocations`，再渲染 `activeLogEntries`，导致 Tool 整块视觉上「置顶」，与对话真实时间线不一致。
- `extractToolInvocationsFromChunk` 构造的条目不含 `arguments`，且 `upsertToolInvocation` 调用时也未传入参数；若后续仅依赖 chunk 路径更新，则 UI 会一直缺少参数。后端完成态若不带 `arguments`，也可能覆盖前端已有值（取决于合并逻辑）。

## Goals / Non-Goals

**Goals:**

- 日志查看器内条目顺序与用户感知的一次回复内发生顺序一致（Tool 与 LLM 交错）。
- 同一条 tool/skill 在 running → completed 过程中，用户能看到非空的调用参数（在任一阶段曾提供过即可）。

**Non-Goals:**

- 不改变聊天主列表里「正文 + 下方 Tool 状态列表」的整体布局（除非后续单独提出）。
- 不强制要求后端新增完整分布式链路追踪；优先用事件顺序或简单单调序号/时间戳。

## Decisions

1. **时间轴数据源**  
   - **决策**：在客户端维护一条与当前 assistant 回复绑定的**追加式时间轴**（例如 `{ kind: 'tool' | 'llm', id, order }[]`），在收到 `tool_status` 与 LLM 日志事件时按接收顺序追加；日志弹窗按该数组顺序渲染，再从 `toolInvocations` / `llmLogs` 取详情。  
   - **备选**：仅在后端为每类事件打统一 `sequence` 再排序——实现成本高，可作为后续优化。

2. **参数合并**  
   - **决策**：`upsertToolInvocation` 对顶层与子工具一律采用「新事件 `arguments` 仅在 `!== undefined` 时覆盖，否则保留旧值」；`extractToolInvocationsFromChunk` 从 `tool_call` 解析 `arguments` 并传入。  
   - **备选**：仅修后端——不足以覆盖纯 chunk 路径，前后端同时收敛更稳。

3. **后端完成态**  
   - **决策**：在 `emitToolEvent` 发送 completed/failed 时，若当前事件没有参数，则复用 `seenToolStatuses` 或并行结构中已记录的最后一次非空参数（与现有 running 事件对齐）。  
   - **备选**：始终只发 running 带参、completed 不带——依赖前端合并即可；若前端仍有路径丢参，则后端补一层更保险。

## Risks / Trade-offs

- **乱序 SSE** → 若代理缓冲导致事件重排，仅靠到达顺序可能不准；缓解：后续为事件加 `sequence` 或服务器时间戳。  
- **时间轴条目与详情脱节** → 若用 id 关联，需保证 tool/llm 的 id 稳定且唯一；缓解：沿用现有 `toolId` 与 LLM `entry.id`。

## Migration Plan

- 纯前后端行为变更，无数据迁移；发版后通过一轮手工对话（含多工具 + 多轮 LLM）验收时间轴与参数。

## Open Questions

- 是否需要在 SSE 载荷中增加显式 `sequence` 字段（由 agent-core 递增），以便将来多连接/重放场景下仍严格有序。
