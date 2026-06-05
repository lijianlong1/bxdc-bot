> **Status:** Superseded by change `openai-standard-chat-roles`（标准 OpenAI `role`，不再做网关侧 `assistant`/`ai`/`system` 改写）。保留本目录仅供历史查阅。

## Why

当前对接的大模型网关（OpenAI 兼容接口）不接受对话消息中的 `role: "assistant"`，会导致请求失败或拒答。需要在全链路把发往模型服务的报文中的该角色统一为 `role: "ai"`，并保证外发 HTTP 请求体中不再出现 `"assistant"` 作为消息角色。

## What Changes

- 在 **agent-core** 中，对所有经 LangChain `ChatOpenAI`（及同一 `configuration.fetch` 路径）发往模型服务的 chat/completions 类请求，在序列化前将消息角色 `assistant`（及历史里已存在的别名如 `assistank`）规范为 `ai`。
- 审查并补齐 **history 组装、工具/子 Agent 内嵌调用** 等路径，避免任何遗漏导致请求体仍含 `assistant`。
- **前端** 继续可使用 UI 层的 `assistant` 表示助手消息；仅在 **提交给后端的 history / 与模型直连的 payload** 中满足「无 `assistant`」约束（与现有 `useChat` 中部分映射对齐并收束一致）。
- 新增 OpenSpec 能力 **`llm-gateway-message-roles`**，将「外发 LLM 请求不得含 `assistant` 角色」写成可验收需求。

## Capabilities

### New Capabilities

- `llm-gateway-message-roles`：约束 agent-core（及必要的客户端 history 格式）向大模型网关发送的消息列表中，模型侧历史轮次的角色使用 `ai`，不得出现 `assistant`。

### Modified Capabilities

- （无）本变更为网关兼容性与实现约束，不修改已有 `agent-client` 等对 SSE/UI 行为的规范性描述；前端内部类型仍可保留 `assistant` 语义。

## Impact

- **代码**：`backend/agent-core`（`AgentFactory` / `ChatOpenAI` 配置、自定义 `fetch` 或模型绑定层）、`agent.controller` 中 history 归一化；必要时 `frontend` `useChat` 等与 history 拼接处。
- **日志**：启用 `LLM_RAW_HTTP_LOG` 时，`llmOrg.log` 中记录的请求体应反映实际发送内容（即角色为 `ai`），便于核对网关兼容性。
- **依赖**：不新增第三方依赖；可能依赖 `@langchain/openai` 的可扩展点（如自定义 fetch 改写 body，或官方支持的 role 映射若存在则优先使用）。
