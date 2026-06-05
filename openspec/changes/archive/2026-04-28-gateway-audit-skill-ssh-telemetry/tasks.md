## 1. 数据库与实体

- [x] 1.1 为 `gateway_outbound_audit_logs` 设计并执行迁移：新增 `skill_id`、代理请求 JSON（或约定列名）、HTTP 响应相关列（状态码、响应头 JSON、响应体 LOB、截断/哈希标志等），兼容 `NULL` 旧行。
- [x] 1.2 新建 SSH Skill 审计表（名与索引以 design 为准），JPA 实体与 `Repository`；确认 **不** 映射私钥/密码明文列。

## 2. skill-gateway：HTTP 外呼审计增强

- [x] 2.1 在 `GatewayHttpClientAuditInterceptor`（或集中写审计处）读取 **`ClientHttpResponse`**，将状态码、响应头（脱敏）、响应体（截断）写入新列；失败路径同样尽量记录。
- [x] 2.2 在写 HTTP 审计行时解析入站头 **`X-Skill-Id`**（或实现约定名）与 **`ApiRequest` body**，填充 `skill_id` 与 **proxy 请求 JSON**；与 `origin_*` 职责划分见 design，避免无意义重复。
- [x] 2.3 复用/扩展 `AuditHeaderJsonBuilder` 或等价逻辑处理 **响应头** 脱敏；响应体大小受 `app.gateway-audit.max-payload-bytes` 或新配置约束。
- [x] 2.4 **外呼侧** `destination` / `outbound_headers_json` / `outbound_body` **必须**从 **实际** `ClientHttpRequest` 与发送 body 字节流得出（脱敏/截断后），**不得**仅由 `ApiRequest` 在另一层重拼；归一化 URL 见 design §6。

## 3. skill-gateway：SSH 专用审计

- [x] 3.1 在 SSH / linux-script 执行链（如 `BuiltinToolExecutionService`、SSH 服务）在每次 Skill 相关调用结束时 **写入** 新表；可选短期内 **双写** `recordSsh` 旧行，在 tasks 或注释中说明淘汰计划。
- [x] 3.2 填充 `agent_request_json`、解析后的 **host/port/user/command**、**目标** 与 **结果**；对含密钥字段的 body **清洗**后再存。

## 4. agent-core（若采用显式头）

- [x] 4.1 在扩展 Skill 执行路径上为 `POST /api/skills/api`、相关 SSH/linux-script 调用增加 **`X-Skill-Id`**（值 `workingSkill.id`）等与 design 一致的头；无 id 时不传。
- [x] 4.2 确认 **OPENCLAW** 子循环里对 API/SSH 扩展工具的调用 **同样** 携带子 Skill 的 **`X-Skill-Id`**（与 4.1 同一来源，**无** 额外业务分支则视为完成）。

## 5. 测试与文档

- [x] 5.1 补充/更新 `GatewayOutboundAuditMvcTest` 或同类集成测：断言新列非空（在 mock 响应可控时）；SSH 新表插入 smoke 测。
- [x] 5.2 可选：在 `docs/agent-skill-execution-flows.md` 或运维文档中增加「审计表扩展与 SSH 新表」一句指引。
