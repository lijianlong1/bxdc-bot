## MODIFIED Requirements

### Requirement: Linux 脚本执行 Skill 接口
系统 MUST 提供 **Linux 脚本执行** 能力（如内置工具名 `linux_script_executor` 与 `POST` **Skill Gateway** 之 `linux-script`），在请求中使用 **`serverId`（在 Agent 侧由用户给定的 `serverName` 经**台账/lookup**解析得到，或用户直接给出之合法 id）** 与 **`command`** 在受控的 Linux 服务器上执行脚本，并返回执行结果；MUST NOT 在 Agent 或对外工具参数中要求 `host`、`username`、`password` 或 `privateKey`。

#### Scenario: 成功执行脚本
- **WHEN** Agent 已持有一个在台账中可执行的 **`serverId`**，并调用执行能力，且 `command` **通过安全规则**
- **THEN** 系统在对应服务器上执行该命令
- **AND** 返回脚本执行结果

#### Scenario: 与台账 lookup 的衔接
- **WHEN** 用户只提供了 **`serverName`**
- **THEN** Agent MUST 先通过 **`server_lookup`（新语义：返回候选 `serverId`）** 或等价受控能力确定唯一 **`serverId`**
- **AND** 再向 Linux 脚本执行能力传入该 **`serverId`** 与技能/对话中的 `command`

#### Scenario: Agent 不携带凭据
- **WHEN** 模型或扩展技能仅提供别名与 `command`（符合接口约定）
- **THEN** 执行链路 MUST 在 **Java/Skill Gateway 侧** 解析并注入连接与认证信息
- **AND** 凭据 MUST NOT 出现在对模型的工具 schema 的必填字段中

### Requirement: 服务器标识解析
**Gateway 上** Linux 脚本执行请求 MUST 使用 **`serverId`**（及 `command`）在 **服务端** 解析连接配置；**Agent 侧** 的 `serverId` **应** 来自用户 **`serverName`** 经 **`server_lookup`（返回候选 id）** 确定后的唯一条目，除非用户已直接给出合法 `serverId`。任何路径均 MUST NOT 要求调用方直接传入 `host`、`username` 或 `privateKey` 给 LLM 作为执行脚本的常规参数。

#### Scenario: Gateway 使用 serverId
- **WHEN** `linux-script` 请求中包含已授权用户上下文中可解析的 `serverId`
- **THEN** 系统在受控注册表中解析连接并建立执行链路
- **AND** 凭据不出现在对模型的工具参数中

## ADDED Requirements

### Requirement: 禁止并行暴露「全参数 SSH」内置工具
在 Agent 同时注册扩展 Linux 命令类技能时，产品部署 SHALL **不** 再向模型暴露可传入任意 `host`+`username`+密钥或密码的并行内置 `ssh_executor` 工具；**MUST** 通过 **`serverName` →（`server_lookup` 等）→`serverId`** 再 **`linux_script_executor`（或扩展技能经 Gateway 之等价路径）** 完成选机与执行，见 `server-lookup-skill` 与本条之下述场景（若实现采用 Gateway 单跳内联解析，以 `design.md` Open Question 之定稿为准）。

#### Scenario: 已登录用户会话工具集
- **WHEN** 用户已登录并加载带远程 shell 的扩展技能
- **THEN** 可用内置工具列表中 SHALL NOT 包含 `ssh_executor`
- **AND** 远程执行 SHALL 使用 **`server_lookup`（`serverName` → 候选 `serverId`）** 与 **`linux_script_executor`（`serverId` + `command`）** 的约定组合，或实现上等价的受控单跳
- **AND** 模型不可使用已移除之 `ssh_executor` 作为首选路径
