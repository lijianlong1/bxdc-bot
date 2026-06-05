## Context

当前实现（见 `skill-confirmation` 等 change）在 **HTTP 控制器**里消费 `agent.stream()`，在检测到 `CONFIRMATION_REQUIRED` 时 **挂起 Promise**、通过 SSE 通知前端、用户 `POST /agent/confirm` 后 **drain** 流中剩余 chunk，再 **在控制器内** 调用 `invokeExtendedSkillWithConfirmed`。这与 **LangGraph 预置 `createReactAgent`** 的「单图、单执行」假设不一致，并带来下文所述问题。

## Problem analysis

### 1. 为什么提示词里仍出现「让用户确认」？

| 来源 | 机制 |
|------|------|
| **ToolMessage 内容** | 扩展工具首次返回的 JSON 含 `status: CONFIRMATION_REQUIRED`，作为 **assistant/tool 消息链** 的一部分进入 **下一轮 LLM**。模型被训练为「根据工具结果向用户说明下一步」，自然会生成「请确认」类话术。 |
| **工具 description** | 若 `loadGatewayExtendedTools` 或 SSH 等路径仍在 description / 返回里写「用户需回复 confirmed」等，与 **仅按钮确认** 冲突。 |
| **系统提示** | 若未明确「危险操作由界面按钮确认，勿要求用户打字」，模型仍会按通用安全习惯输出确认话术。 |

因此不是「过滤 SSE 不够」，而是 **图状态里给 LLM 的可见内容** 与 **产品语义** 不一致。

### 2. 为什么确认后「不继续执行任务」？

可能叠加多种因素：

- **Pending key 不匹配**：`sessionId` 在 `run` 的 `context` 与 `POST /agent/confirm` 不一致 → Promise 永不 resolve，流挂死或超时。  
- **Drain + 二次执行 的语义缺口**：即使工具第二次调用成功，**若未再触发一次 Agent 节点**（总结、下一步 tool_call），用户只看到 **原始 JSON** 或零星 chunk，体感为「没继续」。  
- **图与外层双路径**：LangGraph 可能仍在推进 **基于第一次 tool result** 的推理，而外层又 **并行** `invokeExtendedSkillWithConfirmed`，日志与完成顺序难以预测，表现为「点了确认没反应」或重复输出。  
- **流结束条件**：若 `drain` 或迭代器在 interrupt 边界行为不符合预期，可能导致 **提前结束** 或 **未 emit 后续 token**。

### 3. 与 ReAct agent 的兼容性结论

**预置 `createReactAgent` + 外层手动「暂停流 → HTTP 确认 → drain → 进程外再调工具」不是 LangGraph 推荐的 human-in-the-loop 形态。** 推荐形态是：

- 在 **图内** 在「执行有副作用的 tool」**之前或之后** 调用 **`interrupt()`**（或官方文档中的等价 API），使执行 **真正挂起** 在 checkpoint；  
- 用户确认后通过 **`Command({ resume: ... })`** 或 **`graph.invoke(..., { configurable: { thread_id } })`** 的 resume 路径 **同一 thread** 继续，**不**在控制器里维护第二套 `loadGatewayExtendedTools` 执行链作为主路径。

这样 **只有一条** tool 执行路径、**一份** checkpoint 状态，避免双通道。

## Goals

1. **单一真相**：扩展 Skill 需确认时，**暂停与恢复** 发生在 **LangGraph 编译图**内；HTTP 仅负责 **把用户选择映射为 resume payload**，不替代图执行 tool。  
2. **对模型的可见性可控**：在 **未确认** 阶段，不向用户对话中注入「请打字确认」的 **最终** 模型输出；工具侧返回或占位符策略在 spec 中写死（见 `agent-confirmation-hil`）。  
3. **会话契约明确**：`sessionId`（或 `thread_id`）与任务/前端状态 **单一来源**，`confirm` 与 `run` 可测试、可追踪。  
4. **可观测**：日志中能区分 interrupt、resume、tool 成功/失败，便于排障。

## Non-goals

- 不改变 Skill Gateway 的 HTTP API 语义（除非 spec 明确要求增加字段）。  
- 不在本 change 内实现通用「任意节点任意 interrupt」——仅 **扩展 Skill 确认** 这一条路径。

## Architecture

### Target state（逻辑视图）

```
User message
    → ReAct graph (LLM → tools?)
    → [Extended skill + requiresConfirmation?]
           → YES: interrupt({ skillId, preview, ... })  // 图暂停，持久化 checkpoint
           → SSE: confirmation_request (不含「请打字」依赖模型)
    → User POST /agent/confirm { sessionId/thread_id, confirmed }
    → Resume graph with Command / configurable resume
    → Tool runs ONCE with confirmed: true inside graph
    → LLM (optional): summarize / next step
    → Stream to client
```

### Components

| 区域 | 职责 |
|------|------|
| **Compiled graph** | 包装或替换裸 `createReactAgent`：对「需确认的扩展工具」使用 **conditional** 或 **wrap tool**，在副作用前 `interrupt()`。 |
| **Checkpoint store** | 使用 LangGraph 自带 checkpoint（内存或 Redis，与部署一致），保证 **同一 thread_id** 可恢复。 |
| **HTTP** | `GET/POST` run：绑定 `thread_id` ↔ 前端 session；`POST /agent/confirm`：**解析 thread** → **resume**，不再 `invokeExtendedSkillWithConfirmed` 作为主路径。 |
| **java-skills / tool 层** | 首次调用不再返回「让 LLM 念给用户听」的长 JSON 作为唯一路径；或返回 **经 middleware 替换** 的占位符（若短期无法改图，则作为过渡方案在 tasks 中标注为 **技术债**）。 |

### Migration from current implementation

1. **引入 checkpoint + thread_id**：`run` 与 `confirm` 均使用同一 `thread_id`（可与现有 `sessionId` 对齐或显式重命名，避免歧义）。  
2. **将 `invokeExtendedSkillWithConfirmed` 从 controller 主路径移除**；逻辑迁入 **resume 后图内 tool 节点** 或 **单例 tool 实现**。  
3. **删除或降级** `drainAsyncIterator` 作为「确认后继续」的核心机制；若保留仅作 **向后兼容** 的 noop 清理，须在代码注释与 spec 标明废弃。  
4. **前端**：`confirmAction` 传 **与 run 相同的 id**；错误信息区分 404（无 pending）与网络错误。

### Risks and mitigations

| 风险 | 缓解 |
|------|------|
| LangGraph API 版本差异 | 以 `@langchain/langgraph@^1.2.0` 为准，在 `tasks.md` 第一步 **钉住官方示例** 与最小 POC。 |
| Checkpoint 存储在开发环境未配置 | 默认内存 checkpoint；生产配置 Redis 等由运维约定。 |
| 迁移期双实现 | 特性开关或短分支，默认新路径；旧路径限时删除。 |

## Open questions

1. **thread_id** 是否与现有 **任务 UUID** 完全合一（推荐），还是单独字段？——实现时在 `agent-client` spec 中敲定。  
2. 确认前是否向用户展示 **自然语言预览**（来自 Gateway）——若展示，**禁止**该段再经 LLM 生成「请回复是」；可由 **模板渲染** 完成。

## References

- LangGraph human-in-the-loop / `interrupt` / `Command`（以项目依赖版本文档为准）  
- 现有代码：`backend/agent-core/src/controller/agent.controller.ts`、`java-skills.ts`、`createAgent` / `createReactAgent` 使用处
