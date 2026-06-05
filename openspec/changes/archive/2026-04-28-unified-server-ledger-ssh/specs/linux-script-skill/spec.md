## MODIFIED Requirements

### Requirement: Linux 脚本执行 Skill 接口
系统 MUST 提供一个 built-in skill 接口，用于根据 `serverId` 和 `command` 在**当前用户**的服务器**台账**所指向的 Linux 服务器上执行脚本，并返回执行结果。

#### Scenario: 成功执行脚本
- **WHEN** Agent 调用 Linux 脚本执行 Skill，并提供对当前用户**有效**的 `serverId` 与**通过安全策略的** `command`
- **THEN** 系统从**数据库中的服务器台账**解析连接信息
- **AND** 在目标服务器上执行该命令
- **AND** 返回脚本执行结果

### Requirement: 服务器标识解析
系统 MUST 根据**当前用户身份**与 `serverId` 从**持久化服务器台账**中解析**主机地址与凭据**（`host` 或 `ip`、`username`、`password` 等），而不是要求调用方在请求中直接传入 `host`、`username` 或私钥/密码；也**不** 以应用配置中的**全局多机环境映射**作为该次请求的**权威**凭据源。

#### Scenario: 使用 serverId 查找台账并建立连接
- **WHEN** 请求中包含 `serverId`（与 HTTP 请求体中台账主键 `id` 同义，若二选一以实现对调用方**对外单一字段名为准**）
- **AND** 该 `serverId` 对应当前用户下一条存在且凭据可读的台账行
- **THEN** 系统从**该台账行**加载连接信息
- **AND** 使用**该行中的凭据**建立 SSH 执行链路
- **AND** 不依赖调用方在消息体中附带明文密码

### Requirement: 非法 serverId 错误处理
系统 MUST 在 `serverId` 无法**在当前用户的服务器台账**中解析、或**无权访问** 时返回明确错误，而不是尝试对未知或越权目标执行命令。

#### Scenario: serverId 对当前用户不存在
- **WHEN** 请求中的 `serverId` 在**当前用户**的服务器台账中**不存在**对应记录
- **THEN** 系统返回**未找到**该服务器或无权访问的明确错误
- **AND** 不建立 SSH 连接
- **AND** 不执行任何远程命令

#### Scenario: 凭据在台账中未完整配置
- **WHEN** 找到台账行，但**缺少**建立 SSH 所必需的字段（如 `host`/`ip`、认证信息）
- **THEN** 系统拒绝执行
- **AND** 返回说明配置不完整的错误信息
