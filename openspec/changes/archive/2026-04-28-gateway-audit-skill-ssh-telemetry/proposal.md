## Why

运维与合规需要按 **Skill** 与 **用户** 维度追溯外呼与远程执行：当前 `gateway_outbound_audit_logs` 对 HTTP 已能部分记录入站与出站，但 **缺少稳定 skill 关联**、**缺少对 agent 传入的代理请求体的显式结构化留存**、且 **未持久化外呼 HTTP 的响应**；SSH 类能力虽复用同表的部分字段，但 **未** 将「agent 请求 / 网关注解后的执行参数 / 目标与结果」结构化分栏，难以与扩展 Skill 生命周期对齐。本变更在**可存储大小与脱敏策略受控**的前提下，增强 HTTP 审计行并 **新增 SSH Skill 专用审计表**。

## What Changes

1. **`gateway_outbound_audit_logs`（HTTP 相关行）优化**  
   - 增加 **`skill_id`**（可空：非扩展路径、旧数据、或无法解析时）。  
   - 显式保留 **agent-core → skill-gateway** 对 **API 代理** 的 **原始 JSON 请求体**（即 `ApiRequest`：`url` / `method` / `headers` / `body` 等，可以 JSON 列或规范化存证，与「入站 capture」分工见 design）。  
   - 补充 **外呼 HTTP 响应**：至少 **HTTP 状态码**、**响应头（可脱敏）**、**响应体**（支持截断 + 哈希，与现有 payload 上限配置对齐）。  
   - 出站请求 **地址、请求头、请求体** 为 **线路上真实发出** 的报文（与 `ApiRequest` 意图分列存储，**不得** 用业务侧随意拼造冒充外呼真实报文；见 design）。  
   - **OPENCLAW** 内触发的 API/SSH 子扩展 Skill **纳入**同一套审计；`skill_id` 以**实际执行**的子 Skill 为准，本阶段 **不** 单独建模「一次外呼多 Skill」多身份。

2. **新增关系表**（名称以设计为准，如 `skill_ssh_invocation_audit_logs`）  
   - 记录 **SSH 类 Skill 相关** 调用（范围含直连 `/api/skills/ssh` 及经 **linux-script** 等执行远程 shell 的路径，以设计为准）。  
   - 字段至少包括：**skill_id**、**执行用户 id**、**agent-core 请求参数**（原始 body/JSON）、**skill-gateway 实际用于 SSH 的执行参数**（解析后的 host/port/command 等，**禁止**明文落库私钥）、**目标服务器**（可 host:port + 台账 id）、**执行返回结果**（stdout/摘要/错误，可截断）。

## Capabilities

### New Capabilities

- `gateway-http-skill-outbound-audit`：规定 HTTP 外呼审计在关联 Skill、入站代理参数、出站报文与 **HTTP 响应** 上的持久化要求与脱敏边界。  
- `skill-ssh-invocation-audit`：规定 SSH 类 Skill 专用审计表的 schema 语义、写入时机与与 `gateway_outbound_audit_logs` 的关系（并存或迁移策略见 design）。

### Modified Capabilities

- （无）—— 不在本 proposal 阶段修改既有 `llm-org-audit-storage` 等；本变更聚焦 Gateway 侧 Skill 执行审计。

## Impact

- **skill-gateway**：JPA 实体、迁移/SQL、`GatewayOutboundAuditService`、`GatewayHttpClientAuditInterceptor`（或等价层）以读取响应体、可选 `BuiltinToolExecutionService` / SSH 服务在写 SSH 审计时双写或切到新表。  
- **agent-core**：为在审计中稳定写入 **skill_id**，对扩展 API/SSH 相关 Gateway 调用 **可能** 需增加 **`X-Skill-Id`**（或等价）入站头（以 design 为准）。  
- **存储与合规**：表体积与 PII 上升，需配置 **截断、保留期、脱敏**；**非 BREAKING** API 契约以「新增列/新表」为主，旧消费者读表需兼容可空新列。
