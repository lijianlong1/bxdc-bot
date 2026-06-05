## 1. 配置与文档

- [x] 1.1 在 `backend/agent-core/.env.example` 中增加原始 HTTP 日志开关说明（变量名、取值、风险、`llmOrg.log` 路径）
- [x] 1.2 （可选）在 `docs/mac-local-verify-deploy.md` 或现有部署文档中增加一句启用方式

## 2. 核心实现（agent-core）

- [x] 2.1 新增模块（如 `src/utils/llm-raw-http-log.ts`）：读取环境变量开关；提供 `createLoggingFetch()` 包装全局 `fetch`，将 request/response 元数据与 body（含流式 `clone`/`tee` 策略）以 NDJSON 或单行 JSON 追加写入 `logs/llmOrg.log`
- [x] 2.2 对 `Authorization`、`api-key` 等头做 redact；对大 body 做截断标记；写入失败时 catch，不影响主请求
- [x] 2.3 在 `AgentFactory.createAgent` 创建 `ChatOpenAI` 时，当开关开启传入 `configuration: { fetch: loggingFetch, baseURL: ... }`（与现有 `baseUrl` 逻辑合并），确保仅影响主 Agent 模型调用
- [x] 2.4 确保 `logs` 目录不存在时创建；开关关闭时不创建包装器或包装器为 no-op

## 3. 验证

- [x] 3.1 本地开关 off：跑一轮对话，确认无 `llmOrg.log` 或文件无新增相关行
- [x] 3.2 本地开关 on：跑一轮对话，确认 `llmOrg.log` 出现请求/响应记录且聊天功能正常；流式场景下回复完整无截断错误
