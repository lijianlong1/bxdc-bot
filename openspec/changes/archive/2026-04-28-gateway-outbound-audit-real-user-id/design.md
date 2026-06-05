## Context

- skill-gateway 在 `POST /api/skills/api` 等路径上，由 `SkillIngressCaptureFilter` 将 **`X-User-Id`** 放入 MDC（`MDC_USER_ID`）；`GatewayOutboundAuditService` 取 `AuditPrincipalResolver.currentAuditUserId()` 写入 `user_id`。
- 若 MDC 无用户，则回退为 Spring Security 主名 **`agent-core`**（`SecurityConfig` 中 API Token 通过后的固定 `Authentication` 名），导致审计行无法按终端用户检索。
- agent-core 的 `loadGatewayExtendedTools` 已掌握 `userId`，但 **`executeConfiguredApiSkill` / `executeCurrentTimeSkill`** 请求 Gateway 时**未**传 `X-User-Id`。

## Goals / Non-Goals

**Goals:**

- 在**存在** `userId` 的 agent 运行上下文中，对触发 `HttpClientAuditMode.SKILL_OUTBOUND` 的 **Gateway 入站请求**携带 **`X-User-Id`**，使 `gateway_outbound_audit_logs.user_id` 为终端用户 id。
- 与现网约定对齐：`X-User-Id` 的语义与同模块中 `gatewaySkillReadHeaders` / 其他 Skill 执行路径一致（trim 非空字符串）。

**Non-Goals:**

- 不修改 `SecurityConfig` 中服务主体名为 `agent-core` 的认证模型（入站仍靠 Token）。
- 不强求匿名/无 `userId` 时会话中会出现真实用户 id（此时尚未传头，行为可仍为 fallback，见 spec 区分）。

## Decisions

1. **在 agent-core 补头，不改为由 Gateway 从 body 猜用户**  
   - **Rationale**：用户身份已在 agent 会话中；`X-User-Id` 与现有 API 一致，且 `SkillIngressCaptureFilter` 已实现 MDC 链路。  
2. **扩展 `executeConfiguredApiSkill` 签名**增加可选参数 `userId?: string`（或等效在调用处构造 `headers` 与 axios 入站头），与 `loadGatewayExtendedTools` 透传。  
3. **`executeCurrentTimeSkill`** 同样传入 `userId`（从调用点 `isCurrentTimeSkillConfig` 分支透传），避免仅 API 类扩展修复而 time 类仍缺用户。

## Risks / Trade-offs

- **[Risk]** 单测/ mock 的 axios 需断言多一个 header。  
  - **Mitigation**：更新 `java-skills` 相关 `test/*.test.cjs` 中的 `axios.post` 预期。  
- **[Trade-off]** 无 `userId` 时行仍可能为 `agent-core` 或 `null`（依解析顺序）。在 spec 中写清**有上下文时必须带**、无上下文不强制。

## Migration Plan

- 代码发布即可；历史行保持原样。  
- 回滚：去掉 `X-User-Id` 传递即恢复旧审计语义。

## Open Questions

- 无。
