## 1. 数据库与实体清理

- [x] 1.1 在 `schema.sql` 增加 `DROP TABLE IF EXISTS`（`user_skill_invocation_logs`、`agent_core_invocation_audit_logs`）
- [x] 1.2 删除实体与 Repository：`AgentCoreInvocationAuditLog`、`UserSkillInvocationLog` 及对应 `*Repository`

## 2. 服务与调用链

- [x] 2.1 删除 `AgentCoreInvocationAuditService`、`UserSkillInvocationLogService`
- [x] 2.2 简化 `ApiProxyService`（移除 AGENT_CORE 审计模式与相关 `callApi` 重载分支）
- [x] 2.3 简化 `TaskDispatcherService`（移除 `doFinally` 中的审计写入）
- [x] 2.4 恢复 `UserService` / `UserController` 中头像与 memory 调用为无审计参数的 `callApi` 用法
- [x] 2.5 移除 `SkillController`、`SystemSkillController` 中的用户 Skill 调用日志注入与 `record` 调用
- [x] 2.6 移除 `HttpClientAuditMode.AGENT_CORE_INVOCATION` 及 `HttpClientAuditContext` 中 operation ThreadLocal（死代码）

## 3. 配置与验证

- [x] 3.1 删除 `app.user-skill-invocation.*` 等仅服务于已删表 的配置项（`application.properties` / example）
- [x] 3.2 全仓 grep 确认无残留引用；`mvn test`（skill-gateway）通过
