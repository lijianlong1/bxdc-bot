## Why

当前远程 shell 在 Agent 侧存在 `ssh_executor`（全参数凭据）、旧语义 `server_lookup`（易返回 IP/用户等过宽信息）与 `linux_script_executor` 等多条路径，技能配置又常标注 `ssh_executor`，与「凭证不出现在模型侧」目标不一致。本变更将 **执行脚本** 收束为：**Agent 用用户说的 `serverName` 经台账解析出 `serverId`，再把 `serverId` 与技能内固定 `command` 交给 Skill Gateway 的 Linux 脚本接口**；**删除** 仅 `ssh_executor` 这条直连全参数路径。

## What Changes

- **BREAKING**：从 Agent 默认工具中 **移除** `ssh_executor`（`JavaSshTool`），不再对模型暴露可填 `host`/私钥/密码的直连 SSH 工具。
- **BREAKING（语义）**：保留内置工具 **`server_lookup`**，能力 **改为**：根据 **`serverName`** 返回 **按相关度排序的最多 5 条** 候选，每条以 **`serverId`** 为主键（+ 展示字段），**MUST NOT** 向模型返回 IP、username、password 等作「自行拼 SSH」用。
- **执行顺序（规范要求）**：当用户以自然语言指认服务器而唯一 `serverId` 未在对话中已明确时，Agent SHALL 先调 **台账 `serverName` → `serverId` 解析**（上述 lookup），在唯一确定 **`serverId`** 后，再调 **`linux_script_executor`（及扩展技能路径）** 将 **`serverId` + 技能中配置的脚本/命令** 发往 Skill Gateway 的 `linux-script` 执行；凭据仅在校验后的 Gateway 内使用。
- **技能生成器**：生成类技能仍配置固定 `command` 与 `executor: linux_script_executor`；`interfaceDescription` 等 SHALL 说明「先用 lookup 得 `serverId` 再带 `serverId` 调执行」的字段契约（与实现中的 Zod 一致）。
- 更新系统提示、**agent-extended-skill-priority** 等：不再提及 `ssh_executor`；**明确** `server_lookup` 与 `linux_script_executor` 的先后关系，而非删除 `server_lookup`。
- 存量技能与 DB 迁移、执行器字段值调整见 `design.md` / `tasks.md`。

## Capabilities

### New Capabilities

- 无独立新目录名；`server-lookup-skill` 为 **行为重写** 而非删除。

### Modified Capabilities

- `server-lookup-skill`：由「返回 IP/连接详情供 SSH」改为 **「根据 `serverName` 返回候选 `serverId`（及消歧信息）」**；仍作为 Agent 内置工具挂载（名称以代码为准，如 `server_lookup`）。
- `linux-script-skill`：对外执行请求 **以 `serverId` + `command` 为权威**；`serverName` 到 `serverId` **不** 在此接口内完成时由前序 lookup 完成。
- `built-in-skill-generation`：生成之远程命令类技能与 **`linux_script_executor` + 台账 lookup 流程** 一致；**不** 再指向 `ssh_executor`。
- `agent-extended-skill-priority`：更新工具列举与路由说明（**含** 新语义的 `server_lookup`，**不含** `ssh_executor`）。
- `ssh-skill`：REMOVE 面向 Agent 的直连 SSH 规范（见 `specs/ssh-skill/spec.md` delta）。

## Impact

- **agent-core**：保留并改造 `JavaServerLookupTool` 的请求/响应形态（仅 `serverId` 候选项）；`agent.ts` 仍注册 lookup + `JavaLinuxScriptTool`；移除 `JavaSshTool`；`executeServerResourceStatusSkill`、提示词、单测。
- **skill-gateway**：`GET/POST` 之 server-lookup 实现与 OpenAPI 变更；`linux-script` 入参保持 **`serverId` + `command`**；如现有 lookup 为「按 name 查 IP」，需改数据投影与鉴权；内部 `/api/skills/ssh` 对 Agent 的可见性见 `design.md`。
- **frontend**：若技能管理或调试 UI 曾展示「lookup 返回 IP」，改为展示 **`serverId` 候选项** 等。
- **OpenSpec 归档**：合入 `server-lookup-skill` 的 MODIFIED delta，而非 REMOVED。
