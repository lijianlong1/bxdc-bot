## REMOVED Requirements

### Requirement: ssh_executor 内置工具

**Reason**: SSH Extension Skill（`kind: "ssh"`）通过服务器台账连接并执行命令，功能覆盖 `ssh_executor` 的所有场景。保留多个 SSH 入口增加维护成本和用户困惑。

**Migration**: 使用 SSH Extension Skill 替代。创建 `kind: "ssh"` 的 Skill，配置 `command` 字段，通过 `server_lookup` 选择目标服务器后执行。

#### Scenario: 通过 SSH Extension Skill 执行命令
- **WHEN** LLM 需要在远程服务器上执行命令
- **THEN** 系统使用 SSH Extension Skill（`POST /api/skills/execute`，`kind: "ssh"`）执行

### Requirement: linux_script_executor 内置工具

**Reason**: 与 SSH Extension Skill 功能完全重叠——都是通过服务器台账连接执行命令。区别仅在于命令由 LLM 动态传入还是预配置。SSH Extension Skill 已支持动态 `command` 参数。

**Migration**: 使用 SSH Extension Skill 替代。台账号通过 `server_lookup` 获取后传入 Skill。

#### Scenario: 通过 SSH Extension Skill 执行 Linux 脚本
- **WHEN** LLM 需要在台账服务器上执行脚本
- **THEN** 系统使用 SSH Extension Skill（`POST /api/skills/execute`，`kind: "ssh"`）执行
- **AND** LLM 将 command 作为参数传入

## ADDED Requirements

### Requirement: SSH 操作单一路径

系统 SHALL 确保所有 SSH 相关操作仅通过 SSH Extension Skill（`kind: "ssh"`）这一条路径执行。

Agent 的 `loadGatewayExtendedTools` SHALL 不注册 `ssh_executor` 或 `linux_script_executor` 工具到 LLM 工具列表。

#### Scenario: LLM 需要执行 SSH 操作
- **WHEN** LLM 需要在远程服务器上执行命令
- **THEN** LLM 可用的工具列表中仅包含 SSH Extension Skill 用于 SSH 操作
- **AND** `ssh_executor` 和 `linux_script_executor` 不存在于工具列表中

### Requirement: 清理 AGENT_EXPOSE_SSH_EXECUTOR 相关逻辑

系统 SHALL 从 `agent.ts` 中移除 `AGENT_EXPOSE_SSH_EXECUTOR` 环境变量检查逻辑及其关联的 `JavaSshTool` 注册代码。

#### Scenario: Agent 启动时构建工具列表
- **WHEN** Agent Factory 构建工具列表
- **THEN** 不检查 `AGENT_EXPOSE_SSH_EXECUTOR` 环境变量
- **AND** 不注册 `JavaSshTool` 或 `JavaLinuxScriptTool`
