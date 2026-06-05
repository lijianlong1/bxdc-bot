# 当前工作区与 GitHub（`origin/prop`）差异说明

**对比基准**：本地未提交变更（及本文件）相对远程分支 **`origin/prop`**（仓库：`https://github.com/lskrat/bxdc-bot.git`）。  
**统计**（仅已跟踪文件粗略量）：约 40 个文件变更，+1500 / −400 行级别；另含未跟踪的 OpenSpec 变更目录与若干新建 Java 源文件。

本文重点说明 **SSH / linux-script 类能力**、**审计**、**台账** 相关改造，以及 **存量数据与数据库** 需要配合的动作。

---

## 1. 功能总览（非 SSH 部分，便于对照）

| 区域 | 概要 |
|------|------|
| **Gateway 出站 HTTP 审计** | `gateway_outbound_audit_logs` 增列：`skill_id`、`proxy_request_json`、HTTP 响应相关列等；请求/响应体大字段使用 **LONGBLOB**；读响应失败时仍尽量落库（避免整行丢失）。 |
| **SSH 专用审计表** | 新表 `skill_ssh_invocation_audit_logs`（实体 `SkillSshInvocationAudit`），与旧表 **短期双写**（见下文）。 |
| **入站头** | `SkillIngressCaptureFilter` 增加 `X-Skill-Id` → MDC；扩展 Skill 可关联 `skills.id`。 |
| **agent-core** | 扩展 Skill 调 `POST /api/skills/api`、linux-script 等时带 **`X-Skill-Id`**（`workingSkill.id`）；无 id 时不传。 |
| **API 代理入站体** | `ApiRequest.headers` 改为 `Map<String, Object>`，兼容 **`"Origin": ["url"]`** 等数组形式，避免反序列化 400。 |
| **文档** | `docs/agent-skill-execution-flows.md` 等补充审计与头约定。 |

---

## 2. SSH 类 Skill / linux-script 改造（重点）

### 2.1 能力边界说明

- **「SSH 类」在仓库里可能指**：
  - 内置 **`POST /api/skills/ssh`**（`ssh_executor` / `BuiltinToolExecutionService.executeSsh`）；
  - 内置 **`POST /api/skills/linux-script`**（按 **server_ledger 台账 id** 在服务端解凭据后执行）；
  - 扩展 Skill 配置里 **`kind: ssh` / 监控类** 等由 agent 经网关转发（若走 `/api/skills/api` 则受 HTTP 审计影响）。
- **本阶段审计**：上述路径在成功/失败时调用 **`GatewayOutboundAuditService.recordSsh`**，**同时**：
  - 仍写 **`gateway_outbound_audit_logs`** 一条 `outbound_kind=SSH`（与历史兼容）；
  - 再写 **`skill_ssh_invocation_audit_logs`** 一条（结构化字段：解析后的 host/port/command、`agent_request_json` 脱敏后、`result_body` 等）。

### 2.2 台账与 linux-script（与「存量 SSH 数据」强相关）

- **已移除**：依环境变量 `skill.linux-script.servers` 的 **`LinuxScriptServerRegistryService`**（按机器名查 env 凭据的老路径被删除/废弃）。
- **现行要求**：`linux-script` **必须**通过 **`server_ledgers`** 表在 **该用户** 下已配置好的 **`id` + 主机/用户名/密码或私钥路径** 等；`POST` 体为 `{ "id": <ledgerId>, "command": "..." }` + 头 `X-User-Id`。
- **含义**：若存量部署以前只靠 **env 里配好服务器**、而 **DB 里没有对应台账行**，升级后需要 **把机器录入台账**（UI 或 SQL），否则 linux-script 会 404/400。

### 2.3 扩展 SSH Skill 行（`skills` 表）是否要改 JSON？

- **通常不需要**为审计去改 `skills` 里已有 **EXTENSION / SSH 形态** 的 `configuration` 文本。  
- **但**：若某条技能 **仍然依赖**「仅 env 能解析的服务器名」、且 **没有** 台账 id 驱动的路径，在去掉 env 后需 **改为**：
  - 走 **server_lookup → 选 id → linux_script_executor**，或  
  - 在技能里改为 **与当前网关契约一致** 的配置（以你们产品为准）。  
- **新审计字段 `skill_id`**：依赖 agent 在调用网关时带 **`X-Skill-Id`**；存量技能 **无需** 为此前提单独改库内 JSON，**除非** 你们要在库里记录别的关联。

---

## 3. 数据库与存量数据：需要做什么

以下按 **环境已有表** 分情况。生产常用 **`spring.jpa.hibernate.ddl-auto=update`** + **`schema.sql`（`spring.sql.init.mode`）** 时，多数字段/表会由 **应用 + 脚本** 补全；若生产 **关闭** `sql` 初始化，需 **手跑 SQL** 等价物。

### 3.1 `gateway_outbound_audit_logs`

- **新增列**（与实体一致，可能包括）：`skill_id`、`proxy_request_json`、`outbound_response_*`、……  
- **LONGBLOB**：`origin_body`、`outbound_body`、`outbound_response_body` 在 MySQL 中需为 **LONGBLOB**（避免默认 BLOB=64KB 与 `app.gateway-audit.max-payload-bytes` 冲突导致插入失败）。  
- **存量行**：新列以 **NULL** 为主，**无需** 回填历史业务数据。  
- **仓库内**：`schema.sql` 中已含对三列的 **`MODIFY ... LONGBLOB`** 条件脚本（在 Hibernate 建表/加列**之后**执行，见 `application` 中 `defer-datasource-initialization` 约定）。

### 3.2 新表 `skill_ssh_invocation_audit_logs`

- **新库部署**：由 **JPA / ddl-auto** 或 DBA 按实体建表。  
- **存量库**：无历史数据要迁移进该表；**从上线新代码时刻起** 开始记新表（与旧表双写，旧表仍可有 SSH 行）。

### 3.3 `server_ledgers`（与 linux-script 强相关）

- 请按 **`unified-server-ledger-ssh`** 等 OpenSpec 与当前实体字段（`host`、`port`、`username`、密码/私钥路径等）保证 **每行** 能支撑一次 SSH 执行。  
- **存量仅 name、无 host/凭据** 的行：需在升级后 **补录** host、认证方式等，否则 **linux-script** 会报「台账不完整」类错误。  
- **从 env 迁出**：把原 `skill.linux-script.servers`（或同类配置）中机器 **逐条** 导入或录入 **同一用户** 下的 `server_ledgers`（可脚本批导）。

### 3.4 `system_skills` / 内置 tool

- 内置 `ssh_executor`、`api_caller` 等若已由网关 **`system_skills` + `/api/system-skills/execute`** 使用，**一般** 不改 DB 中定义即可与审计同时生效；**具体** 以你们库中 `system_skills` 数据为准。

### 3.5 回滚与风险

- 审计写失败在代码中 **try/catch** 不阻断主业务；若需回滚应用版本，**注意** 新表/新列在旧代码上的 **兼容性**（通常仅多表多列、可保留）。  
- 删除 **`LinuxScriptServerRegistryService` 后**，**不可** 再依赖仅 env 的 linux-script 解析路径。

---

## 4. 部署后自检建议

1. 调 `POST /api/skills/api` 带小响应体，查 **`gateway_outbound_audit_logs`** 新列是否有值。  
2. 调 **`linux-script`** / **`ssh`** 各一次，查 **`skill_ssh_invocation_audit_logs`** 与旧表 SSH 行。  
3. 扩展 Skill 调代理时带 **`X-Skill-Id`**，查 **`skill_id`** 非空。  
4. 若出现 **`Data too long for column 'outbound_response_body'`**，确认已执行 **LONGBLOB** 迁移/脚本。  
5. 若 **`headers` 中 `Origin` 为数组** 报 400，确认已合入 **`ApiRequest` / `ApiProxyService`** 对 `Map<String, Object>` 的修复。

---

## 5. OpenSpec 与文档索引（本仓库工作区未提交部分）

以下目录/文件在本地可能为**未提交**的提案与说明，**不等同于** GitHub 上已合并内容：

- `openspec/changes/gateway-audit-skill-ssh-telemetry/`  
- `openspec/changes/unified-server-ledger-ssh/`  
- `openspec/changes/...`（其他变更目录）

以各目录下 `design.md`、`tasks.md` 为细节来源。

---

## 6. 文件级变更参考（`git diff origin/prop --stat`）

主要涉及：

- `backend/skill-gateway/...`：`GatewayOutboundAuditService`、`ApiProxyService`、`SkillController`、`BuiltinToolExecutionService`、`ServerLedgerService`、`schema.sql`、审计与实体、测试等。  
- `backend/agent-core/...`：`java-skills.ts` 及 dist、测试。  
- `docs/agent-skill-execution-flows.md`  
- 前端：台账/技能相关 `ServerLedger.vue`、`skillEditor.ts` 等。

（精确列表以 `git status` / `git diff` 为准。）

---

*本文件由本地发布说明需求生成，提交后可通过 `git log -1 -- docs/CHANGELOG-local-vs-github-prop.md` 追溯版本。*
