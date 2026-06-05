# 运维说明：从 env 多机到「服务器台账全字段」

## 变更摘要

- Linux 脚本执行与「用户已登录时」的 `/api/skills/ssh` 台账路径，**凭据**来自 MySQL 表 `server_ledgers`（`host`/`port`/`username`/`password` 或网关机上的 `privateKeyPath`），**不再**依赖 `skill.linux-script.servers.*` 环境映射。
- 可删除或留空对 `skill.linux-script.servers` 的运维配置；保留注释在 `application.properties` 中仅作历史参考时无害。

## 迁移步骤

1. **升级 Gateway** 使 JPA/DDL 为表增加列：`host`, `port`, `username`, `password`, `private_key_path`（如使用 `spring.jpa.hibernate.ddl-auto=update` 会在启动时加列，生产建议显式 DBA 脚本并备份）。
2. **填数**：对已有「仅 `name`」的行，在 **Server Ledger** UI 或管理 API 中补全 `host`、用户与 **密码** 或 **私钥路径**（二选一，私钥优先）。同一用户下 `name` 与 `host` 各不可重复（空 `host` 的存量多行在唯一约束上通常仍允许，直到你补全并冲突时再处理）。
3. **验证**：`GET /api/skills/server-lookup?serverName=...` 仍只返回 `id`/`name`；`POST /api/skills/linux-script` 使用 `X-User-Id` 与 `{"id":<台账自增>,"command":"echo ok"}` 能返回 `result`。
4. **Agent**：确认已传 `X-User-Id` 与 `JAVA_GATEWAY_URL` 指向新进程。

## 回滚

- 回退到**旧** Gateway 时：若新列中已有数据，旧代码可能不读这些列，仍依赖 env 与仅 `name` 的台账，需恢复相应 `skill.linux-script.servers` 与行名一致。
- **回滚前备份** `server_ledgers` 表，避免与 schema 回退不一致导致数据丢失或唯一约束错误。

## 安全与审计

- 密码落库为**明文**（当前实现）；生产环境应限制 DB 访问、备份加密，并计划字段加密或外接凭据服务。
- 列表 API 不返回密码；创建/更新请求体可带密码，JSON 出参不序列化 `password` 字段。
