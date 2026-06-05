## Why

历史上为兼容部分大模型网关，在全链路把助手轮次从 OpenAI 规范里的 `assistant` 改写为 `system`（以及 HTTP 出口对 `assistant` / 非标准 `ai` 等别名的 JSON body 改写），并在外层日志中记录改写后的报文。这与 [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat) 对 `messages[].role` 的约定不一致，也容易使「日志里看到的 role」与心智模型不符。现在希望去掉这类定制改写，使 **实际发出的 HTTP 请求体** 与 **`LLM_RAW_HTTP_LOG` 落盘的 `llmOrg.log`** 均使用一致的 OpenAI 标准角色集合。

## What Changes

- **移除** agent-core 中基于 `fetch` 对 chat 请求 JSON 的 `messages[].role` 批量改写（`utils/llm-request-role-normalize.ts` 中的归一化逻辑；保留「可选原始 HTTP 日志 + 原生 fetch」的组合方式，或合并进 `llm-raw-http-log` 周边，避免重复包装）。
- **移除** `agent.controller` 在组装 `validHistory` 时将助手轮或非标准值转为 `system` 并仅保留 `user`+`system` 的行为；改为仅保留 `user` / `assistant` / `system` 并按 OpenAI 规范传递（非以上 role 丢弃）。
- **移除** 前端 `useChat` 在提交 `history` 时将助手轮映射为 `system` 的逻辑；发往 API 的 `history` 使用与 OpenAI 一致的 `role`。
- **厘清并替代** 既有变更 `openspec/changes/llm-role-assistant-to-ai` 下的目标（该变更曾要求改为 `ai`，与当前实现的 `system` 改写亦不一致）：以本变更为准，**废止**「外发不得含 `assistant` / 必须使用 `ai`」类需求。
- 更新或删除仅服务于旧改写行为的单测/构建产物说明（若有）。

## Capabilities

### New Capabilities

- `openai-chat-message-roles`：约束凡进入 OpenAI 兼容 chat/completions 请求体的 `messages`（含可选原始 HTTP 日志所记内容）使用标准 `role` 值（`system`、`user`、`assistant`、`tool` 等），禁止为适配旧网关而将助手轮次改写为 `system` 或非标准别名。

### Modified Capabilities

- `llm-raw-http-log`：补充要求——当日志开关开启时，所记请求体中的 `messages` 角色 SHALL 与实际发往上游的 HTTP body **一致**（不因额外中间层再次改写 role 而产生与 wire 不一致的日志）。

## Impact

- **代码**：`backend/agent-core`（`llm-request-role-normalize.ts`、`agent.ts`、`user.controller.ts`、`features/avatar/service.ts`、`agent.controller.ts`）；`frontend/src/composables/useChat.ts`；若存在针对 `normalizeChatMessagesRolesInJsonText` 的测试需同步调整。
- **OpenSpec**：新建本 change 下 `specs/openai-chat-message-roles/spec.md`；`openspec/specs/llm-raw-http-log/spec.md` 的 delta（或通过 change 内 delta 体现，依 schema 约定）。
- **行为**：依赖「助手必须是 `system` 才接受」的旧网关将 **不再被兼容**（**BREAKING** 对这类网关）；标准 OpenAI 兼容服务应行为更正确。
