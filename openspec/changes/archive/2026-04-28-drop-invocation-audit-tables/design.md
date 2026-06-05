## Context

skill-gateway 曾引入 `agent_core_invocation_audit_logs`（本网关调用 agent-core）与 `user_skill_invocation_logs`（用户 Skill 调用摘要）。产品决定不再使用这两类数据。

## Goals / Non-Goals

**Goals:**

- 代码与 schema 中彻底移除两张表及写入路径。
- 保留 `gateway_outbound_audit_logs`、`llm_http_audit_logs` 等其它审计能力不变。

**Non-Goals:**

- 提供 UI 或导出工具迁移历史数据（由运维自行处理）。
- 用 feature flag 长期双轨；本次为硬删除。

## Decisions

### D1: 在 `schema.sql` 中 DROP IF EXISTS

**选择：** 在现有 MySQL 初始化脚本末尾增加对两表的 `DROP TABLE IF EXISTS`，与项目「启动时跑 schema」模式一致。

**理由：** 与既有 `information_schema` 条件 DDL 风格并存；简单可靠。

### D2: 删除 Service 与调用方

**选择：** 删除 `AgentCoreInvocationAuditService`、`UserSkillInvocationLogService` 及实体；`ApiProxyService` 恢复为无 AGENT_CORE 审计分支；`TaskDispatcherService` 去掉 `doFinally` 审计；控制器去掉 `UserSkillInvocationLogService` 注入与 `record` 调用。

## Risks / Trade-offs

- **[Risk] 生产库 DROP 丢数** → 部署前确认无需保留或已备份。
- **[Risk] 遗漏引用导致编译失败** → 全仓 grep 后跑 `mvn test`。

## Migration Plan

1. 合并代码并发布 skill-gateway。
2. 首次启动时 `schema.sql` 执行 DROP（或 DBA 手动 DROP）。
3. 验证应用启动与核心 Skill 路径。

## Open Questions

- 无。
