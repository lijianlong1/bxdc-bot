# gateway-skill-outbound-audit Specification

## Purpose
TBD - created by archiving change gateway-outbound-audit-real-user-id. Update Purpose after archive.
## Requirements
### Requirement: 外呼审计 `user_id` 反映终端用户

对由 skill-gateway 写入 **`gateway_outbound_audit_logs`**、且与 **agent-core 经 API Token 调用 Gateway** 相关的 Skill 对外 HTTP 审计行，当**当前对话/任务存在**已识别的终端用户标识（`userId`，非空）时，系统 SHALL 使该行的 **`user_id` 列** 为该终端用户 id，**不得**将纯服务调用方显示名作为唯一可检索的用户主键，以致运维无法按真实用户过滤。

在实现上，agent-core 在调用会触发**出站 HTTP 代理审计**的 Gateway 端点（包括 **`POST /api/skills/api`** 等，以代码为准）时，SHALL 在 HTTP 入站请求上携带与现有 **Skill 列表/读接口** 一致的 **`X-User-Id`** 头，以便 Gateway 在写审计行时解析为终端用户。

#### Scenario: 已登录用户触发扩展 API Skill 外呼

- **WHEN** agent 已绑定非空 `userId`，且执行扩展 **API** Skill 导致 agent-core 向 Gateway 提交代理请求体（`url` / `method` / `headers` / `body`）
- **THEN** 该入站请求 MUST 包含 **`X-User-Id`**，且值 MUST 为当前 `userId`（经 trim 后非空时）
- **AND** 随后落库的 `gateway_outbound_audit_logs` 行在成功写入时，其 `user_id` MUST 与上述终端用户 id 一致（在无额外覆盖逻辑的前提下）

#### Scenario: 无用户上下文

- **WHEN** 当前运行无可用 `userId`（如匿名或测试未注入用户）
- **THEN** 本要求 **不** 强制入站必带 `X-User-Id`；`user_id` 允许保持既有解析结果（如服务身份或 `NULL`），**不得** 因本要求破坏仅服务身份可用的调用

### Requirement: 与既有协议一致

`X-User-Id` 的传递方式、字符集与 trim 规则 SHALL 与 agent-core 中其他 Gateway 入站头（如 `GET /api/skills` 所用 `gatewaySkillReadHeaders`）**一致**，避免同一会话内在列表与执行两条链路上出现不同用户标识源。

#### Scenario: 同一会话内列表与执行

- **WHEN** 同一 `userId` 既用于拉取 `GET /api/skills` 也用于执行某扩展 Skill
- **THEN** 执行链路上的 `X-User-Id` MUST 与列表链路上的用户标识**同源同值**（在两者均非空的条件下）

