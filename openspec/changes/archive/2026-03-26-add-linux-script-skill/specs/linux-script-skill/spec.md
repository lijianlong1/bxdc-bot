## ADDED Requirements

### Requirement: Linux 脚本执行 Skill 接口
系统 MUST 提供一个 built-in skill 接口，用于根据 `serverId` 和 `command` 在预配置的 Linux 服务器上执行脚本，并返回执行结果。

#### Scenario: 成功执行脚本
- **WHEN** Agent 调用 Linux 脚本执行 Skill，并提供有效的 `serverId` 与安全的 `command`
- **THEN** 系统在对应服务器上执行该命令
- **AND** 返回脚本执行结果

### Requirement: 服务器标识解析
系统 MUST 根据 `serverId` 解析服务器连接配置，而不是要求调用方直接传入 `host`、`username` 或 `privateKey`。

#### Scenario: 使用 serverId 查找服务器
- **WHEN** 请求中包含 `serverId`
- **THEN** 系统根据该标识查找预配置的服务器连接信息
- **AND** 使用查找到的连接信息建立 SSH 执行链路

### Requirement: 安全命令过滤
系统 MUST 在执行脚本前对命令进行安全校验，阻止高危命令下发到 Linux 服务器。

#### Scenario: 拦截危险命令
- **WHEN** 请求中的 `command` 命中危险命令规则
- **THEN** 系统拒绝执行该命令
- **AND** 返回明确的错误信息

### Requirement: 非法 serverId 错误处理
系统 MUST 在 `serverId` 无法解析时返回明确错误，而不是尝试执行未知服务器命令。

#### Scenario: serverId 不存在
- **WHEN** 请求中的 `serverId` 不在服务器配置映射中
- **THEN** 系统返回未找到服务器配置的错误
- **AND** 不执行任何远程命令
