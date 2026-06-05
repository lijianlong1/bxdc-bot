## Context

- Agent 使用 `@langchain/openai` 的 `ChatOpenAI` 与 `createReactAgent`；默认序列化通常将 AI 轮次映射为 OpenAI 风格的 `assistant`。
- 当前网关要求使用 `ai` 而非 `assistant`。`agent.controller` 已对入站 `history` 做部分映射（`assistant` / `assistank` → `ai`），但 **LangGraph 多轮内部** 仍可能由客户端库写出 `assistant`，需在 **HTTP 出口** 或 **模型绑定层** 统一兜底。
- 仓库中 `frontend/src/composables/useChat.ts` 已对发往 API 的 history 做部分 `ai` 映射，但仍有路径使用 `assistant`，需与后端策略一致。

## Goals / Non-Goals

**Goals:**

- 任何实际发往模型服务端的 HTTP 请求体（chat messages 数组）中，**不得**出现 `"role":"assistant"`（含大小写变体若网关敏感则需一并规范，至少覆盖小写 `assistant`）。
- 与现有 `user` / `system` 等行为兼容；仅替换模型侧历史角色为 `ai`。
- 子路径（主 Agent、Java Skills 内嵌 `planner.invoke` 等）凡走同一 OpenAI 客户端配置的，一并覆盖。

**Non-Goals:**

- 不改变 SSE 对前端的事件格式中用于展示的 `role: 'assistant'`（若前端协议固定，可保持；本设计聚焦 **模型 HTTP 报文**）。
- 不强制修改 Mem0 / `addMemory` API 的入参枚举（`assistant` 可作为业务语义）；除非这些参数会直接原样进入模型请求（若会，则在该路径单独映射）。

## Decisions

1. **出口层改写优先于零散补丁**  
   在 `ChatOpenAI` 的 `configuration.fetch`（与现有 `llm-raw-http-log` 包装链兼容）中，对 **POST 且 URL 路径含 chat/completions 语义** 的请求体做 JSON 解析，将 `messages[].role === 'assistant'` 改为 `'ai'`，再转发。  
   **理由**：单点兜底，覆盖 LangGraph 内部多轮与工具循环，避免漏网。  
   **备选**：仅 patch `agent.controller` history — 无法覆盖库内部发出的请求。

2. **与现有日志包装顺序**  
   `getLoggingFetchOrUndefined()` 返回的 fetch 外层再包一层「role 归一化」fetch，或在内层统一：先归一化 body，再交给日志记录，保证 `llmOrg.log` 与真实发送一致。  
   **理由**：满足「报文中无 assistant」的可观测性。

3. **入站 history 仍归一化**  
   保留/加强 controller 与前端 history 的 `assistant` → `ai`，减少无效字段进入 Agent；与出口兜底互为冗余，降低风险。

4. **大小写**  
   至少处理小写 `assistant`；若实现采用遍历，可对 `role` 做 `toLowerCase() === 'assistant'` 再写为 `ai`（与网关约定一致即可）。

## Risks / Trade-offs

- **[Risk] 误改非 messages 字段** → **Mitigation**：仅处理已知的 OpenAI chat 请求 JSON 结构（顶层 `messages` 数组）；其它请求原样通过。
- **[Risk] 大 body 解析性能** → **Mitigation**：与现有 raw log 相同量级；可限制仅对 `Content-Type: application/json` 且可解析为对象的 body 处理。
- **[Risk] 流式/非标准端点** → **Mitigation**：若某端点不使用 `messages` 数组，则不修改；主路径覆盖即可。

## Migration Plan

1. 实现 fetch 层 + 必要的 controller/前端 history 对齐。  
2. 本地开启 `LLM_RAW_HTTP_LOG`，跑一轮对话，检查 `llmOrg.log` 中请求体 `messages` 无 `assistant`。  
3. 回归：主 Agent 对话、带 history 多轮、触发 Skill / 子 planner 路径。  
4. 回滚：关闭或移除 fetch 包装即可恢复库默认序列化（若网关仍不接受则需保留）。

## Open Questions

- 网关是否要求 **仅** `ai`，还是同时拒绝 `Assistant` 等大小写变体？当前设计按字符串规范化处理，可按联调结果收紧。
