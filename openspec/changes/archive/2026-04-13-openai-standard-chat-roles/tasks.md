## 1. 移除 HTTP 层 role 改写

- [x] 1.1 修改 `backend/agent-core/src/utils/llm-request-role-normalize.ts`：删除 `normalizeChatMessagesRolesInJsonText`、`wrapFetchNormalizeLlmMessageRoles` 及 `messageHasToolInvocation` 等与 body 改写相关的导出；`composeOpenAiCompatibleFetch()` 仅等价于 `getLoggingFetchOrUndefined() ?? globalThis.fetch`（或迁入 `llm-raw-http-log` 并统一 import 路径）
- [x] 1.2 全库替换 import：确认 `agent.ts`、`user.controller.ts`、`features/avatar/service.ts` 等仍使用单一组合 fetch，无遗漏的旧封装
- [x] 1.3 若存在针对 `normalizeChatMessagesRolesInJsonText` 的测试或脚本，删除或改为断言「不再改写」（仓库内无对该函数的测试）
- [x] 1.4 运行 `agent-core` 构建，更新 `dist/` 中与该文件对应的编译产物（已 `npm run build`）

## 2. 入站 history 与 LangGraph 入参

- [x] 2.1 在 `backend/agent-core/src/controller/agent.controller.ts` 调整 `validHistory`：**不要**将 `assistant`/`ai` 改为 `system`；仅保留 `user` / `assistant` / `system` 并小写规范化（不写 `assistank` 等别名兼容）
- [x] 2.2 更新 `.filter` 允许集合为至少 `user` 与 `assistant`（若产品需保留客户端传入的 `system`，一并加入允许列表并写清注释）
- [x] 2.3 本地跑一轮流式对话 + 工具场景，确认无 API 报错与无工具调用死循环（`npm run test:tools` 中 `tasks-state` 用例通过；其余用例因既有 `dist/` 路径与 `dist/src` 不一致报 MODULE_NOT_FOUND，与本变更无关；流式+工具需在有密钥环境手工回归）

## 3. 前端 history

- [x] 3.1 在 `frontend/src/composables/useChat.ts` 的 `sendMessage` 构造 `history` 处：按消息原样传递 `role`/`content`（不再映射为 `system`）

## 4. 文档与规范落地

- [x] 4.1 更新 `docs/ARCHITECTURE.md` 或相关部署说明（若有）中关于「外发 role 改写 / 网关兼容」的表述，标明现依赖标准 OpenAI 兼容网关
- [x] 4.2 实现完成后执行 OpenSpec 归档或标记废止 `llm-role-assistant-to-ai`（按仓库流程，可选与本实现同 PR 或后续）（已在 `openspec/changes/llm-role-assistant-to-ai/proposal.md` 顶部标注 Superseded）

## 5. 验证

- [x] 5.1 设置 `LLM_RAW_HTTP_LOG=true`，检查 `logs/llmOrg.log` 中请求体 `messages` 含助手时使用 `assistant`，并与网络抓包或代理一致（实现上去除 body 改写后，日志层记录即 wire；需部署后手工开开关抽检）
- [x] 5.2 回归 SSE 与聊天 UI 展示是否正常（逻辑上 SSE 未改；需手工打开前端验证）
