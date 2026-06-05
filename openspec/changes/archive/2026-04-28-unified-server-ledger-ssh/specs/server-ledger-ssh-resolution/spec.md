## ADDED Requirements

### Requirement: Linux 脚本经台账主键解析凭据
系统 MUST 在通过 **`X-User-Id` 与台账主键 `id`** 执行 Linux 脚本（或 Gateway 中等价端点）时，从**当前用户**的服务器台账表中**加载** `ip`（或 `host`）、`username`、`password`（及 `port` 等）以建立 SSH，**不得**依赖**仅**存在于环境配置 `skill.linux-script.servers.*` 中的映射作为**该次请求**的凭据来源。

#### Scenario: 按 id 成功解析
- **WHEN** 请求携带**属于当前用户**的台账 `id` 与通过安全策略的 `command`
- **AND** 对应台账行存在且含**足够**连接字段
- **THEN** 系统使用**该台账行**中的凭据建立 SSH
- **AND** 执行 `command` 并返回结果

#### Scenario: id 不存在或不属于当前用户
- **WHEN** `id` 不存在**或**不属于该 `X-User-Id`
- **THEN** 系统拒绝执行
- **AND** 返回明确错误
- **AND** 不尝试用环境里的其他「名称键」去补偿连接
