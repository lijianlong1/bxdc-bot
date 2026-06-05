## Why

`agent_core_invocation_audit_logs` 与 `user_skill_invocation_logs` 在现网/团队流程中未被使用，继续保留会增加 schema 与代码路径的维护成本。应删除这两张表及所有写入逻辑，避免误用与存储浪费。

## What Changes

- **数据库**：移除 `agent_core_invocation_audit_logs`、`user_skill_invocation_logs`（部署时执行 DROP，新环境不再创建）。
- **代码**：删除对应 JPA 实体、Repository、Service；移除 `ApiProxyService`、`TaskDispatcherService`、`UserService`、`UserController`、`SkillController`、`SystemSkillController` 中的落库调用；删除相关配置项与测试引用。

## Capabilities

### New Capabilities

- `invocation-audit-tables-removed`：平台不再提供上述两张 invocation 审计表及写入能力（与 `gateway_outbound_audit_logs` 等保留能力无关）。

### Modified Capabilities

- **无**（未在 `openspec/specs/` 中单独登记过这两张表的正式 capability）。

## Impact

- **Backend**：`backend/skill-gateway` 删除若干类与调用链；MySQL 既有库需在应用启动脚本或 `schema.sql` 中执行 DROP。
- **运维**：历史数据如需保留，应在 DROP 前自行备份。
