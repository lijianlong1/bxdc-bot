## Context

- Agent 使用 `ChatOpenAI`（`@langchain/openai`）经 OpenAI 兼容 API 调用模型；底层为 Node `fetch`（或 SDK 注入的 fetch）。
- 现有 `LoggerService` 的 `handleLLMEnd` 等回调得到的是 **LangChain LLMResult**，不是 wire 原文。
- 用户需要 **`llmOrg.log`** 保存 **尽可能接近实际 HTTP 层** 的请求/响应文本，用于兼容性与空 `generations` 等问题排查。

## Goals / Non-Goals

**Goals:**

- 开关为 **off** 时：与现状行为一致，**不**增加可测延迟、**不**写 `llmOrg.log`。
- 开关为 **on** 时：对 **经该 ChatOpenAI 实例发出的、面向模型 baseURL 的 HTTP 调用** 记录 request/response（含 URL、method、headers 策略见下、body；流式响应记录策略见下）。
- 日志文件路径：`backend/agent-core/logs/llmOrg.log`（`process.cwd()` 下 `logs/`，与 `llm.log` 同目录）。
- 开关：**环境变量**（实现时选定一个稳定名称，如 `LLM_RAW_HTTP_LOG=true`），文档写在 `.env.example`。

**Non-Goals:**

- 不在前端展示原始报文；不扩展 `llm-log-viewer` UI。
- 不对所有进程出站请求抓包（仅绑定到 **LLM 客户端** 使用的 fetch）。
- 不实现集中式日志轮转/脱敏中心产品化（可在风险中提示运维配置 logrotate）。

## Decisions

1. **注入点：自定义 `fetch` 传给 `ChatOpenAI`**  
   - **理由**：与 OpenAI SDK 请求路径一致，能拿到 request body 与 response。  
   - **备选**：HTTP 代理/mitm —— 部署重，不采纳为默认实现。

2. **流式响应**：对 `response.body` 使用 `tee` 或 `clone()` 后异步读取并追加写入，**不得**破坏原有 `response` 的消费方。  
   - **理由**：避免 LangChain 流解析失败。  
   - **备选**：仅记录非流式 —— 信息不足，不采纳。

3. **敏感头与 Authorization**：记录策略二选一须在实现时定稿：  
   - **推荐 A**：Authorization / `api-key` 头值写 `[REDACTED]`，body 内密钥可另做简单字符串替换或整段记录并文档警示。  
   - **推荐 B**：仅记录 path + status + content-type + body 长度摘要（弱排查）— 与用户「原始报文」诉求不符，仅作降级选项。  
   - 本设计默认倾向 **A + 文档强警示**。

4. **日志格式**：每事件一行 **JSON**（或 NDJSON），字段至少含：`ts`、`direction`（`request` | `response`）、`url`（可截断 query 敏感参数）、`status`（响应）、`bodyPreview` 或分段 `body`（流式可多条 `response_chunk`）。  
   - 若单条 body 过大，实现可设 **最大字节数** 截断并在字段中标 `truncated: true`。

5. **Avatar 等其它 `ChatOpenAI` 实例**  
   - **决策**：首版仅 **Agent 主链路**（`AgentFactory.createAgent`）注入；`AvatarService` 等若需一致行为可在 tasks 中列为可选后续任务。

## Risks / Trade-offs

- **[Risk] 密钥与隐私进入磁盘** → **缓解**：默认关闭；文档与 `.env.example` 明确风险；可选 redact 头。  
- **[Risk] 大流量撑满磁盘** → **缓解**：截断、按大小告警、运维 logrotate。  
- **[Risk] `fetch` 签名与 SDK 版本差异** → **缓解**：实现时对照 `@langchain/openai` 与 `openai` 包类型定义做兼容。  
- **[Risk] 双读 response body 失败** → **缓解**：try/catch 内降级为仅记 metadata，不抛到业务路径。

## Migration Plan

- 部署：合并后无需迁移数据；按需设置环境变量并重启 agent-core。  
- 回滚：去掉环境变量或还原代码；删除 `logs/llmOrg.log` 由运维处理。

## Open Questions

- 流式场景是否额外记录 **逐行 SSE 原文** 还是合并为单次 response 结束块（实现阶段按可读性与性能折中选定）。  
- `llmOrg.log` 文件名是否需可配置（环境变量 `LLM_RAW_HTTP_LOG_PATH`）— 可作为 tasks 中的可选小项。
