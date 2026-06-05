## Context

- LangGraph / LangChain 路径下，工具调用通常来自 assistant 消息的 `tool_calls`；部分模型或网关只把「拟调用工具」写在正文里，用 `<tool_call>...</tool_call>` 包裹 JSON。
- 前端 `useChat.extractToolInvocationsFromChunk` 与后端 `agent.controller` 的 `extractStartedToolCalls` 均从结构化字段取数；正文中的标签当前不参与解析。
- 用户希望：**提示词**强化标准 tool calling；**可选开关**在弱结构化时从文本解析以识别工具与参数（主要用于前端轨迹与可观测性）。

## Goals / Non-Goals

**Goals:**

- 在 Agent 系统提示（或工具绑定说明）中增加清晰、可维护的英文/中文混合说明：优先使用 API 原生 function/tool calling；若只能文本输出，则使用约定标签包裹 **单条 JSON 对象**（含 `name` 与 `arguments` 或等价字段），便于与前端解析器对齐。
- 前端提供持久化开关（建议 `localStorage`，键名在实现时固定并文档化）；开启时，在 `extractToolInvocationsFromChunk`（或等价集中入口）中：若从消息对象得不到可用的 `tool_calls`，则从 assistant 文本（`content` / 多段 `content` 中的 text / `text` 字段）中 **正则或扫描** 提取 `<tool_call>...</tool_call>` 内 JSON，解析为与现有 `ToolInvocation` 形状兼容的结构，并生成稳定 `toolId`（例如基于序号与 name 的哈希或序号前缀），以便与后续 `tool_status` 尽量对齐。
- 开关关闭时，行为与当前版本一致。

**Non-Goals:**

- 不保证在「仅正文、无结构化 tool_calls」时 **后端 LangGraph 一定执行工具**；若需执行，需模型或网关最终提供可消费的结构化调用，或另开变更在 agent-core 做正文注入（本设计不强制实现）。
- 不规定具体模型供应商的私有协议；仅约定 `<tool_call>` 内 JSON 的最小字段集合。

## Decisions

1. **解析优先级**  
   开关开启时：**若** 同一条消息同时存在非空结构化 `tool_calls` 与 `<tool_call>` 文本，**默认以结构化为准**，仅当结构化为空时回退到 XML 解析。  
   **理由**：避免重复展示与 id 冲突。

2. **JSON 形状**  
   标签内为单个对象或对象数组需在设计评审时二选一；建议先支持 **单个对象** `{ "name": string, "arguments": object | string }`，多个调用使用多个 `<tool_call>` 块。  
   **理由**：与常见伪代码一致，解析简单。

3. **开关位置**  
   放在聊天页工具条或设置抽屉（与现有「日志查看」同级区域），带简短说明。  
   **理由**：会话级实验特性，不必进后端用户表（除非产品后续要求同步）。

4. **提示词存放**  
   在 `AgentFactory` / 创建 `ChatOpenAI` 或 `createReactAgent` 的 system 片段中追加一段常量 `TOOL_CALLING_POLICY`（或写入既有 AGENT_*_POLICY 旁）。  
   **理由**：单点维护，可版本化。

## Risks / Trade-offs

- **[Risk]** 正文解析与后端 `tool_status` 的 `toolId` 不一致 → 轨迹无法合并。  
  **缓解**：解析器生成的 id 规则与后端 `extractStartedToolCalls` 的 fallback 规则对齐文档化；若后端仍无结构化调用，可能只有前端「虚拟」条目，与 SSE `tool_status` 可能仍脱节——需在 UI 标明或后续打通后端。
- **[Risk]** 模型输出畸形 JSON → 解析失败。  
  **缓解**：try/catch，失败则跳过该块，不阻塞聊天主流程。

## Migration Plan

1. 默认关：老用户无感知。  
2. 开启开关的用户：若模型已支持原生 tool_calls，行为与关一致。  
3. 回滚：移除开关 UI 与解析分支即可。

## Open Questions

- 是否需要在 agent-core 侧 **同样** 解析 `<tool_call>` 并 `emitToolEvents`（与前端对齐）？若需要，可作为 phase 2 任务。
