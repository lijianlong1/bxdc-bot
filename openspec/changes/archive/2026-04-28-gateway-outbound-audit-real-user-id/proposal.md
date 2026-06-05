## Why

`gateway_outbound_audit_logs` 用于追踪 Skill 对外 HTTP/SSH 行为，但当前在常见路径上 `user_id` 往往落为 **`agent-core`**：agent-core 通过 API Token 认证时 Gateway 的 Security 主体会话固定为服务身份，**未**在入站请求上带终端用户的 **`X-User-Id`** 时，审计解析会回退到该主体会话名。运维与合规需要按**真实用户**过滤与归因，应在外呼审计行中记录 **终端 `userId`**（在会话存在用户上下文时）。

## What Changes

- **agent-core**：凡经 Gateway 代理出站、且会写入 `gateway_outbound_audit_logs` 的调用（尤其 **`POST /api/skills/api`** 上的扩展 API Skill 与 `time` 等走同一代理的路径），在存在 **`userId`** 时 **SHALL** 与 `GET/POST /api/skills` 等现有一致，为入站请求附加 **`X-User-Id`**，供 `SkillIngressCaptureFilter` 写入 MDC，进而使 `AuditPrincipalResolver` 与落库行使用真实用户。
- **规范**：在 OpenSpec 中新增/补充对「外呼审计 `user_id` 与终端用户一致性」的 **SHALL** 要求，避免后续回归。

## Capabilities

### New Capabilities

- `gateway-skill-outbound-audit`：规定 Skill 对外行为在 skill-gateway 侧持久化到 `gateway_outbound_audit_logs` 时，**在存在终端用户上下文的前提下**，`user_id` MUST 为终端用户标识，而非仅服务调用方名（如 `agent-core`）作为唯一依据。

### Modified Capabilities

- （无）—— 现有 `llm-org-audit-storage` 针对 `llm_http_audit_logs`，与本变更的 Gateway 内联外呼审计表分离，不修改其条款以免混淆。

## Impact

- **主要**：`backend/agent-core` 中 `java-skills.ts`（`executeConfiguredApiSkill`、`executeCurrentTimeSkill` 及调用链传入 `userId`）。
- **skill-gateway**：**预期无需** 改 Java（入站已支持 `X-User-Id` + MDC）；若集成测试或文档需对齐可顺带更新。
- **数据库**：**无** 表结构变更；行为仅影响**写入值**的语义正确性。
