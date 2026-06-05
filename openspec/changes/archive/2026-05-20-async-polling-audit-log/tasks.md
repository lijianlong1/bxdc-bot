## 1. 数据库 — DDL

- [x] 1.1 创建 `docs/deploy-ddl/004-async-polling-audit.sql`

## 2. Gateway — 实体 + Mapper

- [x] 2.1 创建 `entity/AsyncPollingAuditLog.java`
- [x] 2.2 创建 `mapper/AsyncPollingAuditLogMapper.java`

## 3. Gateway — 审计服务

- [x] 3.1 创建 `service/AsyncPollingAuditService.java`
  - 单条/批量写入、buildBaseLog、safeJson、truncate 助手
  - 写入失败 → `log.warn`，不抛异常

## 4. Gateway — 内部端点

- [x] 4.1 新建 `PollingAuditController.java` — `POST /api/internal/polling-audit/events`
- [x] 4.2 `SecurityConfig.java` — `ApiTokenFilter` 新增 `isPollingAudit` 加入 `needsToken`

## 5. Gateway — Scheduler 审计插入

- [x] 5.1 `AsyncTaskPollingScheduler` 注入 `AsyncPollingAuditService`
- [x] 5.2-5.7 `pollSingleTask` 全链路 5 个 phase 审计日志（GATEWAY_POLL_START / NETWORK_REQUEST / NETWORK_ERROR / EVALUATION / GATEWAY_POLL_COMPLETE）

## 6. Agent Core — 审计插入

- [x] 6.1 新增 `postPollingAudit` 辅助函数 → POST `/api/internal/polling-audit/events`
- [x] 6.2-6.4 `executeConfiguredApiSkillAsync` 三个 phase 审计日志（AGENT_REQUEST / AGENT_RESPONSE / AGENT_ERROR）
- [x] 6.5 `executeConfiguredApiSkill` 新增 `sessionId` 参数，从 `runConfig.configurable.thread_id` 提取并透传

## 7. 验证

- [ ] 7.1-7.4 端到端测试（需部署后执行）
- [x] 7.5 `mvn compile` + `npm run build` 无错误
