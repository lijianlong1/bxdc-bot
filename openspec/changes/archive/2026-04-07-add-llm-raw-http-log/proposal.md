## Why

联调第三方大模型（如智谱 GLM 等 OpenAI 兼容网关）时，现有 `llm.log` 只记录 LangChain 回调加工后的结构化字段，无法对照 HTTP 层的真实请求与响应（含 SSE 原文），排障困难。需要在 **agent-core** 侧可选地落盘 **原始交互报文**，且默认关闭以避免密钥泄露与磁盘膨胀。

## What Changes

- 在 **agent-core** 中通过 **自定义 `fetch`**（或等价 HTTP 钩子）拦截发往模型 `baseURL` 的请求与响应体（含流式时按可读策略记录）。
- 启用时将记录追加写入 **`logs/llmOrg.log`**（与现有 `logs/llm.log` 并列），每行或每段为可解析的 JSON/分隔记录，带时间戳与方向（request/response）。
- 增加 **显式开关**（建议环境变量，默认 `false`）：仅在为真时记录；关闭时零开销路径（不包装 fetch / 不写文件）。
- 文档：在 `.env.example`（或部署文档）中说明开关名、风险（含 API Key 明文）与日志路径。

## Capabilities

### New Capabilities

- `llm-raw-http-log`: 定义可选原始 HTTP 报文落盘、开关行为、日志文件路径与最小安全提示。

### Modified Capabilities

- （无）本变更为新增可观测性子能力，不改变现有 `llm-log-viewer` 的 UI 与 SSE 结构化日志语义。

## Impact

- **代码**：`backend/agent-core` 中 `AgentFactory` / `ChatOpenAI` 初始化路径；可新增小模块 `llm-raw-fetch.ts` 或并入 `logger.service` 周边。
- **依赖**：无新版本硬性要求；依赖 `@langchain/openai` 对 `fetch` / `configuration` 的传入方式（实现时按当前 lock 版本对齐）。
- **运维**：磁盘增长、敏感信息；**默认关闭**；生产启用需合规与轮转策略（非本变更必选，可在 design 中列为后续）。
