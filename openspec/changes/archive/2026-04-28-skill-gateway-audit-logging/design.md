## Context

skill-gateway 已通过 `AuditAspect` 在 `SkillController` 的 SSH/API 方法后写入极简的 `audit_logs`：Skill 标签、URL 或命令串、较短的 `params`、状态，且 `agentId` 常为 `"unknown"`。这对事故响应**不够**：未存储实际送出的完整 HTTP headers/body，未存储 **入站** agent-core 信封，SSH 行也未与统一 correlation 上下文绑定。

agent-core 经 HTTP 调用 gateway Skill；参数可能在序列化、代理或 gateway 映射中丢失。排障需要 **字节级一致**（或与序列化器一致）的两份副本：(a) agent-core 发出的内容；(b) gateway 向下游 API 或 SSH 层发出的内容。

## Goals / Non-Goals

**Goals:**

- 用**一张**统一的对外审计表覆盖 skill-gateway 驱动的 **HTTP 客户端**执行与 **SSH 命令**执行。
- 每条记录：已认证 **user**（或稳定服务主体）、**UTC 时间戳**、目标（**URL** 或 **SSH host:port** 标识）、与真实发送一致的 **outbound payload**（HTTP：捕获的请求报文；SSH：实际执行的命令字符串），以及该次调用的 **agent-core 原始入站**（gateway 收到的完整 inbound request）。
- 对会 **调用 agent-core** 的 Skill 走独立审计路径：经 skill-gateway 持久化 user、time、skill name、skill 参数及 **response/result**。

**Non-Goals:**

- 在本变更中建设完整 SIEM、日志检索 UI 或长期冷存储层（以入库与 schema 为主；只读查询 API 可选）。
- 定义全组织法务保留策略（仅预留 policy hook）。
- 除非为传递 correlation id 所必需，否则不改变对外公共 REST 契约。

## Decisions

### D1: 对外 API + SSH 单表

**选择：** 单表 + **discriminator** 列（如 `OUTBOUND_KIND` = `HTTP` | `SSH`），以及按类型可空的列或 JSON 列存放扩展字段。

**理由：** 需求为「一张表」；统一查询与保留策略；可空列使各行按类型稀疏。

**备选：** 两表（类型更清晰、多 join）；因产品明确要求单表而放弃。

### D2: 在 HTTP 客户端边界做保真捕获

**选择：** 在 gateway 构造好 `ClientHttpRequest`（或等价物）之后、真正 I/O 之前拦截：复制 method、完整 header map、以及准备发往链路的 body 字节。优先使用框架扩展点（例如 Spring `ClientHttpRequestInterceptor` + buffering），使入库 blob 与客户端库实际发送一致。

**理由：** 满足「实际请求报文的复制，而不是拼接还原」；避免仅从 DTO 还原。

**备选：** 只记录反序列化后的 Java 对象；不满足保真要求。

### D3: 在 gateway 入站侧捕获 agent-core 来源

**选择：** 在 agent-core 调用 Skill 的 HTTP 入口，将 **raw request body**（及策略允许的 headers，如 `Content-Type`、鉴权头）捕获到 **request 作用域** 容器中，并以 **correlation id**（`X-Correlation-Id` 或生成 UUID 写入 MDC）为键。对外审计行 **必须** 引用同一 correlation id，并持久化捕获的 origin 字节（或 TEXT/BLOB 存 base64 等无损编码）。

**理由：** 「agent-core 原始请求」是 gateway **实际收到**的字节，而非 map 再序列化。

**备选：** 依赖 agent-core 向 internal endpoint 再 POST 一份；可作为**补充**，但「gateway 看到了什么」以入站捕获为准。

### D4: SSH「全量内容」

**选择：** 单列存储传入 SSH 会话的 **精确命令字符串**；可选将解析后的 remote user/host/port 放在单独可索引列便于检索。

**理由：** SSH 不是 HTTP；「报文」对应命令行 + 会话上下文类 metadata。

### D5: agent-core Skill 调用审计（往返）

**选择：** 新表（如 `agent_core_skill_invocation_logs`），**仅**在 skill-gateway 内实际执行 agent-core 回调的代码路径写入。列含：user id、`recorded_at`、skill name/skill id、发往 agent-core 的 **request payload**（JSON/text）、**response payload**（raw HTTP body 或结构化错误）、HTTP status、可选 correlation id 与对外/origin 行关联。

**理由：** 区分「gateway 调 agent-core」与「gateway 调外网 API/SSH」，与需求第二条一致且 schema 更清晰。

**备选：** 在对外表上再加 discriminator；可行但混淆方向；独立表更清晰。

### D6: 用户身份

**选择：** 从既有安全上下文（`X-User-Id`、JWT 或内部服务账号）为两类审计一致填充 user；对已认证路由停止使用占位 `"unknown"`。

**理由：** 需求字段。

### D7: 体积上限与失败策略

**选择：** 每字段可配置 **max stored bytes**（对齐 `LlmHttpAuditService` 一类模式）；超限时写入 **截断标记 + 全量 hash**，后续迭代可再 spill 到对象存储。

**理由：** 保护数据库；spec 要求 MUST 且行上可观测。

## Risks / Trade-offs

- **[Risk] 原始负载导致库体积膨胀** → 缓解：TTL/归档任务、可配置上限、可选压缩、索引仅打在 metadata 列。
- **[Risk] header/body 中的 secrets** → 缓解：可配置 redaction 列表（如 `Authorization`、cookie），**文档化**行为：整头删除并标注，或仅 hash——产品需拍板；默认至少 redact `Authorization`。
- **[Risk] 热路径性能** → 缓解：异步只增写入、有界队列、fail-open（审计写失败 **不得** 阻断 Skill；打指标）。
- **[Risk] agent-core 未传 correlation id** → 缓解：gateway 在缺失时生成并在 response header 返回供 agent-core 记录；仅当入站捕获失败时才允许无 origin 关联的出站记录——spec 侧宜要求尽力完整。

## Migration Plan

1. 通过 Flyway/Liquibase 或项目既有 migration 机制新增表/列（对齐 `skill-gateway-mysql` 约定）。
2. 在非生产环境默认 **开启** 审计写入并观察体量。
3. Backfill：不需要（仅新数据）。
4. 回滚：通过开关关闭写入；保留表供排查；回滚不做破坏性 drop。

## Open Questions

- 生产与 staging 的脱敏策略是否一致（法务/合规 vs 全量保真）。
- agent-core 是否 MUST 对所有 Skill 调用带 `X-Correlation-Id`，或仅 gateway 生成即可。
- 在强制对象存储前，单条 payload 的实际上限。
