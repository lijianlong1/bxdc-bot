## MODIFIED Requirements

### Requirement: Server Lookup Skill
The system SHALL provide a built-in skill `server-lookup` that allows the Agent to retrieve **candidates to disambiguate** a server by a user-provided name (or best-effort string), returning **at least** a stable `id` 与**展示**用名称（如 `name` 或 `label`），**MUST NOT** 在成功体中向模型返回**可用于自行拼完整 SSH/直连** 的 `password`、私钥、或**单独** 作为连接目标的 `ip`/`host`+`username` 组合，除非**另有经批准** 的只读元数据白名单；模型 SHALL 在需要执行命令时使用该 `id` 配合下游「Linux 脚本执行」类工具，而不是自行发起未托管连接。

#### Scenario: Lookup server by name
- **WHEN** the Agent calls `server-lookup` with a valid or partially valid server name string
- **THEN** the system returns **zero to multiple** 候选，每项含**台账主键** `id` 与 `name`（或等义展示字段）
- **AND** 成功体中**不包含** 明文 `password` 或私钥材料

#### Scenario: Server not found
- **WHEN** the Agent calls `server-lookup` and no server matches the query for the current user
- **THEN** the system returns a clear empty or not-found result suitable for the Agent to decide next steps
- **AND** the system does not leak other users' ledger data

### Requirement: Server Lookup Integration
The system SHALL integrate the `server-lookup` skill with the Agent's toolset so that, when remote execution is needed, the **canonical** flow is: **first** `server-lookup` to obtain a `id`, **then** a separate execution call that sends **`id` + `command`** 至 Skill Gateway 由服务端在**数据库台账**中解凭据并执行，**MUST NOT** 作为首选路径让模型在工具参数中**自行填写** 完整 `host`、**password** 或私钥以发起未托管的直连。

#### Scenario: Agent uses server lookup before execution
- **WHEN** the user asks to run a command on a server known by a natural name
- **THEN** the Agent **SHALL** call `server-lookup` 得到**台账主键** `id`（在仅一条候选时可直接采用，多条时按既有消歧规范）
- **AND** 随后通过 `linux script` 或等义能力传递 **`id` 与** `command`
- **AND** 工具调用载荷中**不包含** 台账中存储的**明文** `password` 或私钥全文
