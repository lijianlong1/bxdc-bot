## Why

实现上曾把**连接信息**从「服务器台账」拆到 `skill.linux-script.servers` 等环境键里，用台账里的 `name` 做桥接。这与「**所有与机器相关的信息集中一张表、执行只认 lookup 到的 id**」的产品预期不一致，也带来 `name` 含点、与配置 key 对不齐等运维负担。现改为：**台账表持久化 ip/host、username、password（及端口等）**；`server lookup` 仍只对模型返回 **id + 可展示字段**；`linux script` 在 **Java 端用 `X-User-Id` + 台账主键 `id` 从数据库加载整行** 后建立 SSH 并执行技能中的命令。

## What Changes

- **BREAKING（部署 / 行为）**：Linux 脚本执行**不再**以 `skill.linux-script.servers.<name>.*` 为**唯一/主要**凭据源；**权威来源**为按用户隔离的**服务器台账表**行。若需过渡期，设计文档中可约定是否**临时保留**仅当 DB 中缺字段时的 env 回退（本提案默认**不**要求回退，以简化实现）。
- **BREAKING（数据模型）**：`server_ledgers`（或同等实体）在现有 `id`、`userId`、`name` 等基础上 **MUST 恢复或新增** 连接字段，至少含 **`ip`/`host`、`username`、`password`**，**MAY** 含 `port`、私钥路径等。迁移策略见 `design.md`。
- **保持对 Agent 的契约**：对外仍是 **`server lookup`（或同义工具）得台账 `id`**，**`linux_script` / 扩展执行仅传 `id` + `command`**；**MUST NOT** 向 LLM 返回可直连用的明文 `password` 于 lookup 成功体。
- **Skill Gateway**：`POST .../linux-script` 在**校验**当前用户**拥有**该 `id` 后，从 DB 取凭据，交给既有 SSH/脚本执行与命令安全校验链。
- **前端**：服务器台账的创建/编辑表单**恢复** ip、用户名、密码等字段的录入；列表/详情在展示策略上与 `server-ledger-management` 规范一致（如列表不返回密码明文）。

## Capabilities

### New Capabilities

- （无；通过修改既有能力完成。）

### Modified Capabilities

- `server-ledger-management`：以**单表**为服务器相关数据的**主存储**；与「仅 name + 环境配置」的实现对齐**回**到规范中已描述的 `ip`/`username`/`password` 等持久化与维护接口行为。
- `linux-script-skill`：`serverId`/台账主键 的解析目标由「环境预配置」改为**当前用户下台账表**中的对应行；失败语义改为「无此台账或无权限」等。
- `server-lookup-skill`：在现有「不向模型泄露凭据」方向上与台账字段对齐，明确 lookup **返回** `id` + 展示用 `name`（等），**不** 返回 `ip`/密码供模型自拼连接（若工作区主规范与 ADDED 片段冲突，以本变更 delta 为准）。
- `server-ledger-ssh-resolution`：在「按用户 + `ip` 查台账」之外，**补充**「按用户 + 台账主键 `id` 解析并用于 Linux 脚本/SSH 执行」的要求。

## Impact

- **backend/skill-gateway**：`ServerLedger` 实体与 JPA 迁移、CRUD、列表脱敏；`LinuxScriptServerRegistryService` / `LinuxScriptServerProperties` 是否删除或仅作**废弃**后兼容由 `design.md` 定稿；`LinuxScriptExecutionService` 或等价层改为从**台账行**读连接参数。
- **agent-core**：若仅 HTTP 字段名有 `id` vs `serverId` 的命名差异，以本变更**统一**或保持与 Gateway 一致；工具描述与单测可小幅更新。
- **frontend**：`ServerLedger` UI、类型与与 Gateway 的契约。
- **文档 / 运维**：删除或弱化对「用 env 配齐每台机」的依赖说明；**密码落库**带来的合规与审计要求见 `design.md`。

