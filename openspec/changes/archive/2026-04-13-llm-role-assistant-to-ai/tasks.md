## 1. HTTP 出口兜底（agent-core）

- [x] 1.1 在 `ChatOpenAI` 的 `configuration.fetch` 链上实现请求体归一化：解析 JSON 中顶层 `messages` 数组，将 `role` 为 `assistant`（及约定的别名如 `assistank`）改为 `ai`，并与 `getLoggingFetchOrUndefined()` 组合，保证日志与真实发送一致
- [x] 1.2 限制改写范围：仅处理 `Content-Type` 为 JSON 且 body 可解析为对象、且存在 `messages` 数组的请求；解析失败时原样透传
- [x] 1.3 将归一化逻辑放在独立小模块（例如 `utils/llm-request-role-normalize.ts`）并在 `agent.ts` 中接入，便于单测或后续复用

## 2. 入站 history 与前端对齐

- [x] 2.1 复核 `agent.controller` 中 `safeHistory` → `validHistory` 映射，确保所有进入 Agent 的模型轮次在发往模型前均为 `ai`
- [x] 2.2 审查 `frontend/src/composables/useChat.ts` 中构造 `history` / 请求体的路径，保证提交给后端的条目不出现 `role: 'assistant'`（UI 层仍可用 `assistant` 表示展示消息）
- [x] 2.3 全库检索 `role` 与 `assistant` 在 agent-core 与前端 API 层的组合，确认无绕过 fetch 兜底的独立 `fetch`/HTTP 客户端调用

## 3. 验证

- [x] 3.1 启用 `LLM_RAW_HTTP_LOG`，跑一轮多轮对话与触发 Skill 的场景，检查 `logs/llmOrg.log` 中请求体 `messages` 无 `"role":"assistant"`
- [x] 3.2 回归 SSE 与前端消息展示未因 history 角色名调整而异常
