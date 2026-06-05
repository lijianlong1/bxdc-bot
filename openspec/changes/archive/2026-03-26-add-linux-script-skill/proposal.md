## Why

当前 Java Skill Gateway 已经提供了通用的 SSH 执行能力，但现有接口要求传入 `host`、`username`、`privateKey` 等底层连接信息，不适合作为内建 Skill 直接暴露给 Agent。新增一个基于 `serverId + command` 的 Linux 脚本执行 Skill，可以让 Agent 以更安全、稳定的方式调用预配置服务器上的脚本能力。

## What Changes

- 在 Java Skill Gateway 中新增一个内建 Skill 接口，用于根据 `serverId` 和 `command` 执行 Linux 服务器脚本
- 复用现有 Java SSH 执行链路，但由服务端负责根据 `serverId` 解析服务器连接配置
- 对执行命令继续应用安全过滤，阻止高危命令直接下发
- 在 Agent Core 中新增对应的 Java Tool，使该能力以 built-in skill 形式暴露给 Agent
- 返回脚本执行结果，供 Agent 继续组织回复

## Capabilities

### New Capabilities

- `linux-script-skill`: 定义基于 `serverId` 和 `command` 执行 Linux 服务器脚本的 built-in skill，包括请求格式、服务端解析逻辑和返回结果

### Modified Capabilities

（无。该能力为新增 Skill，不修改现有 spec 的行为要求。）

## Impact

- **backend/skill-gateway**: 新增 Linux 脚本执行接口、服务器配置解析逻辑，并复用 `SSHExecutorService`
- **backend/agent-core**: 新增 Java Tool，调用新的 built-in skill 接口
- **Security**: 命令继续经过 `SecurityFilterService`，同时避免把私钥等敏感连接信息直接暴露给 Agent 输入
- **Configuration**: 需要定义 `serverId` 到 SSH 连接信息的映射来源
