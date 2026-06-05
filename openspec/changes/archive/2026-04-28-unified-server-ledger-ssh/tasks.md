# Tasks — unified-server-ledger-ssh

## 1. Data model and persistence

- [x] 1.1 在 `server_ledgers` / `ServerLedger` 上增加或恢复 `host`/`ip`、`username`、`password`、（可选 `port`）等列与 JPA 字段；运行或编写 Flyway/Liquibase/Hibernate 迁移策略并与 `design.md` 的迁移步骤一致
- [x] 1.2 明确并实现同用户下唯一性规则（`ip` 与 `name` 二选一或组合约束），与 `server-ledger-management` delta 中 MODIFIED/ADDED 一致
- [x] 1.3 `ServerLedgerService` 对创建/更新/删除/按 `userId+id` 查询行为补全，并避免在异常消息中输出明文 `password`

## 2. Skill Gateway — Linux 脚本执行

- [x] 2.1 修改 `POST /api/skills/linux-script` 路径：在 `getServerLedgerByUserIdAndId` 命中后，从**台账行**读取连接参数，调用 `LinuxScriptExecutionService`（或等义），**不再** 以 `ledger.getName()` 查 `LinuxScriptServerRegistryService` 环境映射为**主路径**
- [x] 2.2 移除或降格 `LinuxScriptServerProperties` + `LinuxScriptServerRegistryService`（若整类删除，清理 `@Component` 与相关测试/配置样例；若保留仅作迁移，须默认关闭并文档化）
- [x] 2.3 若 `POST /api/skills/ssh` 等仍用台账名解析，**统一**为从**同一表**、同一行凭据取数，避免 `name` 与 `ip` 双真值
- [x] 2.4 为「台账无 `password` 或 `host`」等**不完整**场景补充 4xx/明确错误，并更新或新增 `SkillController*Test`

## 3. 服务器台账 API 与脱敏

- [x] 3.1 扩展 `ServerLedgerController` 的 `POST`/`PUT` 请求体与校验，使前端能提交/更新 `ip`、`username`、`password` 等
- [x] 3.2 列表与「获取单条（若有）」响应保持**不**返回 `password` 明文；`GET` 需要时可返回**是否**已设密码的布尔或占位
- [x] 3.3 更新或新增与台账相关的集成测试

## 4. Agent 与前端

- [x] 4.1 核对 `java-skills` / `agent.ts` 中 `linux_script` 与 `server_lookup` 的字段名（`id` / `serverId`）与 Gateway **完全一致**
- [x] 4.2 更新服务器台账管理 UI：表单含 ip、用户名、密码；无多余「依赖 env 配机」的提示
- [x] 4.3 更新技能说明、生成器与单测中关于「凭据在服务端台账」的表述

## 5. 规格与发布

- [x] 5.1 实现完成后对 `openspec/changes/unified-server-ledger-ssh` 的 spec 作最终比对，**archive** 时合并至 `openspec/specs/`（spec delta 已就绪，合并随 `openspec archive` 流程）
- [x] 5.2 编写运维说明：从「env 多机」迁移到「台账全字段」的填数步骤、回滚与备份注意点
