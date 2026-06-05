## Why

`llmOrg` 原始 HTTP 日志（`LLM_RAW_HTTP_LOG`）对排查模型兼容性与空响应等问题很有价值，但当前仅落在 agent-core 本地 `logs/llmOrg.log`，不利于集中检索、权限治理与按用户维度分析。需要将同等语义的可观测数据持久化到数据库，并在每条记录上绑定 **用户标识** 与 **记录时间** 等字段。为满足部署边界，**持久化必须经过 skill-gateway**，由网关写库，agent-core **不得**直连业务数据库。

## What Changes

- 在 **skill-gateway** 增加「LLM 原始 HTTP 审计」持久化能力：REST 接收 agent-core 上报的结构化条目，写入数据库表（含 `user_id`、记录时间、关联 id、请求/响应摘要或正文等字段；具体字段以 design 为准）。
- 在 **agent-core** 扩展 `llm-raw-http-log` 路径：在开关开启时，除（可选）保留现有本地 `llmOrg.log` 行为外，将每次请求/响应记录 **异步 HTTP 上报** 至 skill-gateway；上报载荷携带当前会话解析出的 `userId`（及必要的 `sessionId` / `correlationId`），**不**引入任何从 agent-core 到数据库的依赖。
- **配置**：新增/调整环境变量（例如网关基址、是否启用远程持久化、是否仍写本地文件），默认保持安全与性能上的保守默认值（远程持久化默认关闭或与现有开关联动，见 design）。
- **运维与合规**：文档中明确敏感数据风险；网关侧可考虑鉴权（与现有 `JAVA_GATEWAY_TOKEN` 等机制对齐）。

## Capabilities

### New Capabilities

- `llm-org-audit-storage`：skill-gateway 提供接收 LLM 原始 HTTP 审计条目的 API，校验调用方身份，将记录写入数据库；表结构含用户维度与时间维度字段，便于后续查询与管理。

### Modified Capabilities

- `llm-raw-http-log`：在启用原始 HTTP 记录时，系统 SHALL 支持将等价的审计信息通过 HTTP 提交至 skill-gateway 持久化（并携带 `userId` 与记录时间等元数据）；agent-core SHALL NOT 直接访问持久化数据库。可选保留本地 `llmOrg.log` 作为开发/应急副本（若保留，需在 spec 中明确与远程持久化的关系及开关）。

## Impact

- **agent-core**：`llm-raw-http-log.ts`、`llm-request-role-normalize.ts` / `AgentFactory` 等注入 fetch 或上下文处；`agent.controller` 已具备 `context.userId`，需传入日志路径。
- **skill-gateway**：新增 Controller、Service、Entity/Repository、`schema.sql` 或迁移脚本；`SecurityConfig` / token 校验需覆盖新端点。
- **数据库**：新建表及索引（按用户、时间查询）。
- **部署**：需配置 agent-core 指向可达的 gateway 与 token；无 agent-core 侧 JDBC。
