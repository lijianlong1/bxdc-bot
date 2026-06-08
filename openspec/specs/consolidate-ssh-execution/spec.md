# consolidate-ssh-execution

## Purpose
移除 Agent Core 中冗余的 SSH 内置工具（`ssh_executor` / `linux_script_executor`），统一所有 SSH 操作通过 SSH Extension Skill（`kind: "ssh"`）执行。

## Requirements

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
