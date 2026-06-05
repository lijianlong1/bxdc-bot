## Context

- 仓库曾引入 `composeOpenAiCompatibleFetch()`（`llm-request-role-normalize.ts`）：在 `getLoggingFetchOrUndefined()` 之外再包一层，对 POST JSON body 顶层 `messages` 把 `assistant` / `assistank` / `ai`（无 `tool_calls` 时）改写为 `system`，再发往上游。这与 OpenAI Chat API 约定不符（助手内容应使用 `assistant`）。
- `agent.controller` 在拼接 LangGraph `stream({ messages })` 前将入站 `history` 中同类角色统一为 `system` 并 `.filter(m => m.role === 'user' || m.role === 'system')`，等价于用 `system` 冒充多轮助手。
- 前端 `useChat` 在构造请求 `history` 时做了相同映射。
- 旧 OpenSpec 变更 `llm-role-assistant-to-ai` 描述为改为 `ai`，与当前实现（改为 `system`）不一致；需以「标准 OpenAI role」统一收口。
- LangChain / LangGraph 默认发往 OpenAI 兼容端点的序列化已使用 `assistant` / `tool` 等标准值；移除自定义改写后，库行为与规范一致。

## Goals / Non-Goals

**Goals:**

- 外发 chat/completions 请求体中的 `messages[].role` 符合 OpenAI 规范（至少：`system`、`user`、`assistant`、`tool`；不引入非标准 `ai` 作为 message role）。
- `LLM_RAW_HTTP_LOG` 打开时，`llmOrg.log` 中记录的请求 JSON 与实际 wire 上的 body **一致**（不在日志层再做与发送不同的 role 变换）。
- 会话历史从前后端传入 Agent 时，助手轮使用 `assistant`，而非 `system`；非 `user` / `assistant` / `system` 的入站 role 丢弃（不保留历史拼写别名兼容）。

**Non-Goals:**

- 不改变 SSE 面向 UI 的事件里用于展示的标签（例如仍可出现 `{ role: 'assistant', content }` 的简化事件），只要其与「模型 HTTP」分层清晰。
- 不要求一次性支持带 `tool` / `tool_calls` 的完整多轮历史从客户端恢复（若当前 API 仅传 user/assistant 文本轮次，保持该范围，但不再把 assistant 标成 system）。
- 不重新引入「网关只接受 `ai` role」的兼容层；若仍有非标准网关，由部署侧换用标准兼容实现或 fork。

## Decisions

1. **去掉 fetch 层 role 改写**  
   `composeOpenAiCompatibleFetch()` 仅负责：`getLoggingFetchOrUndefined() ?? globalThis.fetch`，或把文件重命名为 `llm-openai-fetch.ts` 等并删除 `normalizeChatMessagesRolesInJsonText` / `wrapFetchNormalizeLlmMessageRoles`。  
   **理由**：单点改写曾用于非标准网关；标准路径下破坏语义且与日志「真实载荷」诉求冲突。

2. **controller 历史组装**  
   将 `validHistory` 改为：仅保留 `user`、`assistant`、`system`（小写规范化）；**不再**将 `assistant` 或旧非标准值改为 `system`。  
   **理由**：与 OpenAI message 列表语义一致，避免把助手提示误标为 system。

3. **前端 history**  
   `sendMessage` 中构造的 `history`：直接传递 UI 消息中的 `role` 与 `content`（当前仅为 `user` / `assistant`）。  
   **理由**：与后端一致，无额外映射。

4. **日志顺序**  
   保持现有链：「若启用日志，则日志 wrapper 看到的 body 即最终将要发送的 body」。去掉 role 改写后，日志与 LangChain 序列化结果一致。

5. **旧 OpenSpec**  
   实现本 change 后，`llm-role-assistant-to-ai` 中 `llm-gateway-message-roles` 能力视为弃用；归档流程中可由人工合并/废止，不在本 design 强制删历史目录。

## Risks / Trade-offs

- **[Risk] 仍连接只接受非标准 role 的旧网关** → 上游请求可能失败；**缓解**：发布说明中标明 **BREAKING**，建议在网关或模型侧修为标准兼容。
- **[Risk] 历史数据或缓存中混有 `system` 承载的旧「假助手」轮** → 模型上下文语义变化；**缓解**：仅新版本起按规范发送；必要时运维清理或接受一轮上下文重建。

## Migration Plan

1. 在测试环境对主对话、工具调用多轮场景做回归（确认无再将 assistant 写作 system 的需求）。
2. 启用 `LLM_RAW_HTTP_LOG` 抽检 `llmOrg.log`：`messages` 中助手为 `assistant`，且与抓包一致。
3. 部署后若某环境仍报错，转由网关升级或临时分叉配置（不在本仓库恢复改写）。

## Open Questions

- 入站 `history` 是否需正式支持 `tool` 轮次：若当前 API 不传工具消息，可继续在实现中只处理 user/assistant 文本对。
