## Context

- **当前**：台账表（或实体）在代码迭代中被收紧为**仅** `id` + `name` 等，SSH 凭据改由 **`skill.linux-script.servers`** 按 `name` 解析；`POST /api/skills/linux-script` 用 `X-User-Id` + 请求体 `id` 先查库再取 `name` 查 env。
- **目标**（本变更）：与 OpenSpec 中 `server-ledger-management` 等**最初意图**及本次产品决策一致，**同一张表**存展示名、**网络地址、认证信息**，执行路径**只依赖** `lookup` 选出的**台账主键 `id`** 与**服务端用户身份**。
- **干系人**：运行 Skill Gateway/DB 的运维、维护 Agent/前端的开发者、关注凭据与审计的安全角色。

## Goals / Non-Goals

**Goals:**

- 台账行包含执行 SSH 至少所需的字段，并由 **`(userId, id)`** 唯一确定要连哪台机、用哪组凭据。
- `server-lookup`（HTTP/内置工具）**不** 向模型输出明文密码、私钥等；执行接口在**服务端**使用 DB 中凭据。
- 命令**安全过滤**、用户隔离、404/403 等错误语义在「凭据来源=DB」前提下保持清晰可测。

**Non-Goals:**

- 不强制在本变更中实现**完整**的字段级加密、轮换、HSM 或外部 Vault 集成；可在 `Risks` 中记为**后续**加固项，除非实施时选择最小可用的加密落库（由任务拆解决定）。
- 不规定**多机编排**、交互式 TTY 或**批量**并行执行；保持现有 `linux-script` 单次执行语义即可。

## Decisions

1. **主键与鉴权**  
   - 执行请求体仍使用**台账自增/雪花 `id`**（若对外文档写 `serverId`，在 API 中**与 `id` 同义**选一字统一，避免双字段）。  
   - **MUST** 用 `X-User-Id` + `id` 查 `ServerLedger`；**不得**只凭 `id` 越权连他人机器。

2. **表字段**  
   - 至少：`userId`, `id`, `name`（搜索/展示）, `host` 或 `ip`（与现有 `server-ledger-management` 术语对齐）, `username`, `password`；`port` 默认 22 可空。  
   - **私钥 vs 密码**：产品表述为**密码**；若实现保留「私钥路径」为可选，**MUST** 在规范与表单中二选一主路径，避免无文档的第三来源。

3. **移除/废弃环境绑定**  
   - **决定**：生产路径**不**再要求 `LinuxScriptServerProperties` / `skill.linux-script.servers` 为每台机配置凭据。  
   - **备选**（需额外任务若采纳）：仅用于迁移期「DB 无密码列的旧数据」回读 env，并在日志中打 deprecation。

4. **与「按 `ip` 查台账」旧接口的关系**  
   - 若仍保留对 Agent 的「SSH by IP」类接口，**MUST** 与「按 `id`」**共用**同一表内凭据，避免两套真值源。  
   - 本设计以 **按 `id` 执行 linux-script** 为主路径；`server-ledger-ssh-resolution` 的 delta 将补充 id 路径。

5. **密码在 API 与存储**  
   - **列表/集合接口**：不返回 `password` 明文；创建/更新可接收密码字段。  
   - **存储**：优先**强约束**不写入日志/异常栈；可评估 Spring/JPA 层面对敏感字段的 `AttributeConverter` 或库级加密，作为任务项。

## Risks / Trade-offs

- **[风险]** 明文或弱保护密码落库被拖库后影响面大。  
  **缓解**：生产配置加强 DB 访问控制、最小权限、备份加密；实现阶段评估字段加密或外接 Vault。  
- **[风险]** 与「仅靠 env 即可连机」的存量部署不兼容。  
  **缓解**：迁移说明：把原 env 中机器**录入**台账，或使用一次性 SQL/脚本灌入。  
- **[风险]** 唯一性约束从 `(userId, name)` 变为「含 `ip`」时与现网数据冲突。  
  **缓解**：迁移前扫描重复 `ip` 或按设计保留 `(userId, name)` 为主键语义、用另一列存 `ip` 的冲突检测策略。

## Migration Plan

1. 为 `server_ledgers` 增加列（`host`/`ip`, `username`, `password`, `port` 等）；对已有**仅 name** 行，补录方式由运维/脚本或 UI 完成。  
2. 发布 Gateway 新版本：**先**支持读新列、**再**关 env 主路径（若分两阶段发布）。  
3. 回滚：保留可回退的数据库迁移脚本或前序 schema；回滚后若凭据仅在新列，需明确数据丢失风险。

## Open Questions

- 是否在首版**强制**「密码 **与** 私钥二选一」校验，避免两空或两满歧义。  
- `name` 与 `ip` 的**国际复用/唯一性**：沿用归档规范「同用户下 `ip` 唯一」还是「`name` 唯一」以 UI 搜索体验为准。  

