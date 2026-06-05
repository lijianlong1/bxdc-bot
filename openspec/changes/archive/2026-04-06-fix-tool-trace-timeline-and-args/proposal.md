## Why

> **合并说明**：原先重复的变更目录 `fix-tool-trace-timeline-and-parameters`（仅含占位 `.openspec.yaml`，无 tasks/spec）已撤销，统一在本变更跟踪。

当前聊天里 Tool/Skill 的展示与「调用日志」查看器存在两类体验问题：日志查看器把全部 Tool 区块渲染在顶部、LLM 请求/响应在下面，无法反映真实的调用先后顺序；同时界面上「参数」经常为空，用户看不到工具实际入参。需要在产品层明确修复目标并约束客户端（及必要的后端）行为。

## What Changes

- 日志查看器将 Tool/Skill 轨迹与 LLM 结构化日志合并为**单一时间轴**，按实际发生顺序（事件到达顺序或后端提供的可排序字段）展示，而不是整块置顶。
- 前端在解析 SSE 时**合并并保留工具调用参数**：来自 `tool_status` 的参数不得被后续无参更新覆盖；从 LangGraph 流式 chunk 解析出的 tool call 也应尽可能提取并传入 `arguments`。
- 若后端在完成态事件中未携带参数，应在 agent-core 侧保证完成事件**继承**运行态已发出的参数，或从 tool 结果消息中回填，避免前端收到「空参数」的完成事件。

## Capabilities

### New Capabilities

（无；行为归属现有 agent-client / chat-ui 能力扩展。）

### Modified Capabilities

- `agent-client`：补充工具参数合并规则，以及日志时间轴与 SSE 事件顺序的约束。
- `chat-ui`：补充日志查看器中「混合时间轴」展示要求，与现有「按实际发生顺序」条款对齐。

## Impact

- **前端**：`frontend/src/composables/useChat.ts`（SSE 处理、`upsertToolInvocation`、`extractToolInvocationsFromChunk`）、`frontend/src/components/MessageList.vue`（日志弹窗内列表渲染与排序）。
- **后端（若需要）**：`backend/agent-core` 中 `AgentController` 对 `tool_status` 事件的 `arguments` 字段在 running → completed 之间的传递。
- **测试**：针对合并列表顺序与参数保留的单元测试或手动验收清单。
