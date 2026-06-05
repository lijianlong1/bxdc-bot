## Context

- 现状：`gateway_outbound_audit_logs` 中 HTTP 行由 `GatewayOutboundAuditService.baseHttpRow` 写入；`origin_*` 为 **Gateway 入站**快照（`SkillIngressCaptureFilter`），`outbound_*` 为 **外呼**；**未** 持久化 **HTTP 响应体/状态码**。`skill_context` 为短字符串（如 `skill.external-http`），**无** `skill_id` 列。  
- SSH：`recordSsh` 写 **同一张表** `outbound_kind=SSH`，含 `ssh_command`、`destination`（host:port）与入站 `origin_*`，**无** 独立「agent 请求体 vs 解析后执行参数」分栏。  
- agent-core 调 `/api/skills/api` 的 body 为 **ApiRequest**；**不含** `skillId`，Gateway 单看请求体无法可靠反查扩展 Skill 主键，需 **agent 显式传元数据** 或 **后续** 由网关根据业务键解析（本设计优先 **显式头** 以降低歧义）。

## Goals / Non-Goals

**Goals**

- HTTP 外呼审计行可关联 **skill_id**（可空），并落库 **ApiRequest 原始结构** 与 **完整 HTTP 响应**（受截断/脱敏配置约束）。  
- 新增 **SSH Skill 专用审计表**，列清楚 **谁、哪条 Skill、agent 发什么、网关最终执行什么、对哪台机、回什么**。

**Non-Goals**

- 不在本阶段定义 **运营 UI** 或 **对外查询 API**（可跟迭代）。  
- 不在行内存 **SSH 私钥/密码** 明文。  
- 不强制**删除** `gateway_outbound_audit_logs` 中既有 SSH 行（可 **双写** 一阶段再废用，见 **Decisions**）。  
- **本阶段不** 为「**同一次** HTTP 外呼链路内同时挂 **多个** Skill 身份」单独建模；审计行仍按 **单次外呼 = 单一 `skill_id` 头**（或空）处理即可。

## Decisions

1. **skill_id 来源**  
   - **推荐**：agent-core 在调用 `POST /api/skills/api`、`POST /api/skills/ssh`、`POST /api/skills/linux-script` 等时增加 **`X-Extension-Skill-Id`**（或统一名 `X-Skill-Id`），值为 **Gateway `skills` 表主键**（字符串或数字以头约定为准）。Gateway 写审计时优先取该头，**缺失则 NULL**。  
   - **理由**：代理 body 的 `ApiRequest` 无 skill 主键，扩展工具侧已知 `workingSkill.id`。

2. **「原始参数」在 HTTP 行的落点**  
   - 新增列如 **`proxy_request_json`（LONGTEXT）**：存 **反序列化后的 ApiRequest 或等价 JSON**（若与 `origin_body` 重复，可只存**解析后**结构以便检索；`origin_body` 保留**原始 bytes** 作取证）。实现阶段二选一，避免三重冗余。  

3. **HTTP 响应**  
   - 在 `GatewayHttpClientAuditInterceptor` 成功/失败路径中，从 `ClientHttpResponse` 读取 **status**、**headers（脱敏）**、**body（截断+sha256）**；列如 `outbound_response_status`、`outbound_response_headers_json`、`outbound_response_body` / `outbound_response_truncated` / `outbound_response_sha256`。  
   - 失败时仍尽量记 **可得的响应体**（如 4xx/5xx body）。

4. **SSH 新表**（示例名 `skill_ssh_invocation_audit_log`）  
   - `id` PK，`recorded_at`，`correlation_id`（可复用现有关联），`user_id`，`skill_id`（可空）  
   - `agent_request_json`：入站 **HTTP body**（如 linux-script 的 `id`+`command` 或 ssh 的 host/username/…）**JSON 字符串**  
   - `resolved_target`：如 `host:port` 或 台账 `server_ledger_id` + 展示名（列可拆分）  
   - `executed_command` 或分栏 **host/port/user/command**（**不含** 密钥）  
   - `result_summary` / `result_body`：SSH 执行返回，截断+哈希同 HTTP  
   - `status` / `error_message`  
   - **写入点**：`BuiltinToolExecutionService` 及 SSH 执行链在 **一次业务调用** 内写 **一行**；若与现有 `recordSsh` 重复，**短期双写** 新表 + 旧行，或仅新表+保留旧表最小字段（以任务拆分）。  

5. **脱敏**  
   - 响应头/体中与 **Authorization** 等 **沿用** `AuditHeaderJsonBuilder` 同类规则；响应体中若含 token，可选用 **配置化** 脱敏或仅哈希+截断。

6. **外呼报文须为「线上真实」而非事后拼凑**  
   - `gateway_outbound_audit_logs` 中 **HTTP 外呼** 的 **请求地址、请求头、请求体** SHALL 来自 **实际执行** `ClientHttpRequest` / 拦截器可见的 **真实 URI 与 body bytes**（及经相同脱敏规则序列化后的头），**不得** 仅用业务侧逻辑字段（例如仅 `ApiRequest` 对象）在其它层 **重新 JSON 组装** 成一份**看似**像外呼、但与线路上最终报文不一致的「展示用」记录。  
   - 若存在 **`OutboundUrlNormalizer`** 等归一化，审计中记录的 URL **应为实际发出请求使用的 URI**（归一化后的最终值），避免与代理入站体中的 `url` 字符串混用而不加说明。  
   - **入站** `ApiRequest` 仍单独存一列（`proxy_request_json` 等）以回答「agent 让网关代理什么」；与 **出站真实报文** 并列，用途不同。

7. **OPENCLAW 内嵌 API/SSH**  
   - **纳入** 本审计范围：与主对话直调扩展 Skill **相同机制**——当 OPENCLAW 子执行器实际触发某条 **API** 或 **SSH** 类扩展 Skill 时，**`skill_id` 以当时被调用的那条子 Skill 为准**（即 **实际触发的** API/SSH Skill 的数据库 id），**不需要** 为 OPENCLAW 容器 Skill 单独造一套 skill 关联，也 **不** 强制在审计行上再挂一层「父 OPENCLAW skill id」（除非后续产品要求；**本阶段按子 Skill 即可**）。  
   - 实现上仍依赖 agent 在子工具调用链上带 **`X-Skill-Id`**（或等价），与主路径一致，**额外处理最小化**。

## Risks / Trade-offs

- **存储膨胀**：大响应 + 大入站体 → 必须 **强依赖** `max-payload-bytes` 与**保留期/归档**策略。  
- **双写/迁移**：SSH 从旧表迁到新表需迁移脚本或双写期 **一致性问题**。  
- **性能**：读响应体在拦截器内消耗 IO → 大 body 时 **只读至上限**。

## Migration Plan

1. 数据库：ALTER `gateway_outbound_audit_logs` 增列 + CREATE 新表。  
2. 应用：写路径先上线，**读**旧数据兼容 NULL。  
3. 回滚：停写新列/新表，旧逻辑不影响外呼主路径（**若** 审计失败不阻断主业务，需在代码中 try/catch 保持现状）。

## Open Questions（已收敛）

| 话题 | 结论 |
|------|------|
| 同一次 HTTP 外呼与 **多 Skill** | **本阶段不考虑** 多 Skill 并存于**同一行**的复杂建模；单行仍 **0 或 1 个** `skill_id`（来自头）。 |
| **OPENCLAW** 内再调 API/SSH | **纳入审计**；`skill_id` = **实际执行** 的 API/SSH 子 Skill；与主路径同一套入站头约定，**尽量不做** 额外分支。 |
| 外呼报文真实性 | 见 **Decisions §6**：落库须贴近 **真实线路上** 发出的请求，**禁止** 用业务对象随意拼一份冒充外呼报文。 |
