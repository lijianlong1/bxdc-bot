## Context

agent-core 在 `LLM_RAW_HTTP_LOG` 开启时，通过包装 `fetch` 将 OpenAI 兼容调用的请求/响应写入本地 `logs/llmOrg.log`（见 `backend/agent-core/src/utils/llm-raw-http-log.ts`）。`AgentFactory.createAgent` 已能拿到 `userId`（来自 `/agent/run` 的 `context.userId`）。skill-gateway 已使用 `JAVA_GATEWAY_TOKEN` 等机制保护 HTTP API，并使用 JPA + `schema.sql` 管理表结构。业务数据库由网关所在环境持有，agent-core 进程不应配置业务库连接串。

## Goals / Non-Goals

**Goals:**

- 在启用审计时，将每条请求/响应记录（含脱敏策略与体积截断策略与现实现有对齐）**异步上报** skill-gateway，由网关写入数据库行，字段至少包含 **用户标识**、**记录时间**（及方向、关联 id、HTTP 元数据、body 或截断正文等）。
- 保持拓扑：**agent-core → HTTP → skill-gateway → DB**，agent-core **不**引入 JDBC/ORM 或直连 DB。
- 失败路径：**不得**阻塞或破坏 LLM 调用主路径（与现有本地写日志的 fire-and-forget 语义一致）。

**Non-Goals:**

- 本变更不要求实现完整运维后台 UI、全文检索引擎或长期冷归档；以「可写入、可按用户/时间查询」为最小闭环。
- 不强制改变上游模型服务的 URL 或鉴权方式；仍是对 agent-core 出站 `fetch` 的观测。
- 不将 skill-gateway 作为 LLM 代理；仅作审计数据接入与持久化。

## Decisions

1. **接入形态：网关专用 REST 端点**  
   - **选型**：`POST` JSON 批量或单条（实现可选用单条简化 MVP）到 skill-gateway 下固定前缀（例如 `/api/internal/llm-org-audit` 或 `/api/llm-http-audit/events`）。  
   - **理由**：与现有网关 REST、Token 校验模式一致，易在 `SecurityConfig` 中放行或保护。  
   - **备选**：Message queue — 运维成本高，非本阶段目标。

2. **身份与多租户**  
   - **选型**：沿用 **`X-Api-Token`（或项目现有 header 名）** 校验调用方为受信任的 agent-core；请求体或 header 携带 **`X-User-Id`**（与工具链一致）表示业务用户。网关将 `user_id` 写入表；若缺失则存 NULL 或拒绝写入（择一并在 spec 中固定）。  
   - **理由**：与 `java-skills` 网关调用约定一致，前端/代理已在链路中解析用户。

3. **与本地 `llmOrg.log` 的关系**  
   - **选型**：**独立开关** — `LLM_RAW_HTTP_LOG` 控制是否包装 fetch 与是否产生记录；新增例如 `LLM_ORG_LOG_REMOTE=true` 控制是否 POST 网关；本地文件可默认在远程开启时仍可选写入（便于开发对比），或通过单一开关文档说明「仅远程」。  
   - **理由**：避免开发环境无网关时无法落盘。  
   - **备选**：远程开启即关闭本地 — 减少磁盘敏感数据，但降低本地排障便利性。

4. **数据模型（示意）**  
   - 表名例如 `llm_http_audit_log`：主键、`user_id`（VARCHAR 或可空）、`recorded_at`（由服务端写入 `now()` 或接受客户端时间仅作参考）、`correlation_id`、`direction`（request/response/section）、`method`、`url`（可截断）、`status`（响应）、`headers_json`（已脱敏）、`body_json` 或 `body_text`（截断后）、`session_id`（可选）、`truncated` 标志等。  
   - **理由**：与现有日志 JSON 结构对齐，便于对照 `llmOrg.log`。

5. **异步与背压**  
   - **选型**：agent-core 侧 `fetch` 到网关使用 **不 await 主链路** 的 fire-and-forget，或短超时队列；失败仅打 debug/warn，不重试风暴。  
   - **理由**：与 `appendRecord` 当前「不因日志失败影响 LLM」一致。

## Risks / Trade-offs

- **[Risk] 日志含用户内容与密钥片段** → 表与备份需按内部敏感数据治理；网关访问控制与最小权限；文档强调生产默认关闭或限权。  
- **[Risk] 高频对话产生大量行** → 索引与保留策略（分区/定期清理）列为后续运维任务；MVP 可先按时间+user 索引。  
- **[Risk] 网关不可用导致「无 DB 记录」** → 接受最终一致性；本地文件开关作为补偿。  
- **[Trade-off] 客户端时间与服务器时间** → 以服务端 `recorded_at` 为准，避免客户端篡改审计时序（若需客户端时间可作非权威字段）。

## Migration Plan

1. 先部署 skill-gateway（新表 + API），再部署 agent-core（新 env）。  
2. 未配置远程开关时行为与现网一致。  
3. 回滚：关闭远程开关；旧版本 agent-core 不写新端点；网关可保留表不动。

## Open Questions

- `user_id` 缺失时：写入 NULL 还是拒绝（401/400）？建议 **允许 NULL** 并打指标，便于未登录调试场景。  
- 是否需要单条 API 的 payload 大小上限（防 DoS）？建议在网关层限制 body 大小。
