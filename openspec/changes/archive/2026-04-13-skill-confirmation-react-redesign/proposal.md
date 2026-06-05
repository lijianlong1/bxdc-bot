## Why

在现有「SSE + 挂起 Promise + `drainAsyncIterator` + 进程外二次 `invokeExtendedSkillWithConfirmed`」实现下，用户仍看到提示词/回复里要求**打字确认**，且确认后**任务不继续**或行为不符合预期。这不是单点 bug，而是 **ReAct 图内语义**与 **HTTP 层硬控制**两条路径叠加，与 LangGraph 的执行模型不一致，继续「缝补」会放大状态分裂与竞态风险。需要在 OpenSpec 层明确根因，并收敛到 **单一、图一致的确认架构**。

## Root cause（摘要）

1. **双通道冲突**：扩展 Skill 仍在图内返回 `CONFIRMATION_REQUIRED` 的 **ToolMessage**；下一跳 **LLM 节点**会读到该 JSON，再叠加工具描述 / 其它工具的 `instruction`（如 SSH），模型仍会生成「请用户确认 / 回复是」类话术——与「仅 UI 按钮确认」的产品语义冲突。
2. **流式消费 ≠ 图取消**：在 `agent.stream()` 外层 `drain` 异步迭代器 **不能可靠地取消** LangGraph 内部运行；且 **图状态里已写入** 待确认的 tool result，与 **进程内第二次直接 invoke 同一逻辑** 形成两条执行路径，追踪与幂等难以保证。
3. **会话键一致性**：`POST /agent/confirm` 的 `sessionId` 必须与发起 `run` 时注入 `context.sessionId` 的值一致（通常应对齐任务/会话 ID）；任一端不一致会导致 **pending 无法 resolve** 或错绑。
4. **「继续任务」语义**：确认后直接展示原始 tool 输出、**不再经 Agent 总结或规划下一步**，用户体感为「停了」；若产品期望确认后仍由 Agent 整理结果或继续多步，则需在图内 **恢复** 一次 LLM（而非仅 HTTP 直出）。

## What Changes

- **架构收敛**：将「需确认的扩展 Skill」从 **外层 HTTP 补丁** 升级为 **LangGraph 一等公民**：采用 **`interrupt()` / resume**（或等价的官方 human-in-the-loop 模式），使 **暂停、恢复、单次 tool 执行** 发生在 **同一 compiled graph** 内，**禁止**再依赖「stream drain + 重复 `loadGatewayExtendedTools` + 二次 invoke」作为主路径。
- **对 LLM 可见内容**：在确认完成前，**不得**将 `CONFIRMATION_REQUIRED` 全文作为对用户的**最终**指令暴露给模型；恢复后由图继续（可选 summarization 节点），或明确 **仅展示结构化结果** 的产品策略（写入 spec）。
- **提示词与工具描述**：全局梳理扩展 Skill / SSH 等仍含「请用户确认 / 回复是」的 **工具 description 与返回 JSON**，与 **UI 硬确认** 二选一；**删除或改写** 与按钮确认冲突的文案。
- **会话契约**：在 `agent-client` / 网关任务层 **固定** `sessionId` 与 `taskId` 的映射与传递规则，并在集成测试中校验 `confirm` 与 `run` 配对。

## Capabilities

### New Capabilities

- `agent-confirmation-hil`: LangGraph 内 human-in-the-loop（interrupt / resume）与扩展 Skill 确认闸门的语义与行为

### Modified Capabilities

- `skill-confirmation`: 将「HTTP 层 drain + 双次 invoke」降级为 **非**主路径或废弃；主路径改为 **图内 interrupt + resume**  
- `agent-client`: `sessionId` / `taskId` 与 `POST /agent/confirm` 的契约及错误处理  
- `skill-discovery` 或工具元数据（若存在）：`requiresConfirmation` 的 tool 描述不得与 UI 确认冲突（可选，若并入 skill-confirmation 则不单列）

## Impact

- **backend/agent-core**：`agent.controller.ts`（瘦身 run 流程）、`agent` 工厂与图定义（`createReactAgent` 自定义或换用 `interrupt` 模式）、`java-skills.ts`（工具包装或从主 ReAct 拆出确认闸门）  
- **frontend**：`useChat` / `api`：保证 `sessionId` 与后端一致；确认失败时重试与提示  
- **依赖**：`@langchain/langgraph` 1.x 的 `interrupt`/`Command` API（以仓库实际版本为准）

## Non-Goals (for this proposal)

- 重写整个产品为多 Agent 系统  
- 在非 LangGraph 场景下复刻同一套 interrupt（若未来有多入口，再单独开 change）
