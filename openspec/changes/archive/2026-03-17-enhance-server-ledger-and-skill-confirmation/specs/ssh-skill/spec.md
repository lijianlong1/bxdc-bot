## MODIFIED Requirements

### Requirement: SSH Skill 通过台账解析登录信息
系统 MUST 在执行 SSH Skill 时，根据当前登录用户和目标 `ip` 从服务器台账中解析登录信息，而不是要求调用方直接传入完整凭据。

#### Scenario: 根据当前用户和 IP 查找凭据
- **WHEN** 已登录用户发起 SSH Skill 调用，并提供目标 `ip` 与 `command`
- **THEN** 系统使用当前用户身份和目标 `ip` 查找对应服务器台账
- **AND** 使用台账中的 `username` 与 `password` 建立 SSH 执行链路

### Requirement: SSH Skill 仅可使用当前用户台账
系统 MUST 限制 SSH Skill 只能使用当前用户名下的服务器台账记录。

#### Scenario: 不读取他人服务器凭据
- **WHEN** 当前用户请求执行一个 `ip` 存在于其他用户台账中、但不存在于自己台账中的 SSH 命令
- **THEN** 系统拒绝执行该命令
- **AND** 不使用其他用户的服务器凭据建立连接

### Requirement: 未登记服务器的错误处理
系统 MUST 在当前用户不存在目标 `ip` 台账时返回明确错误。

#### Scenario: 当前用户未维护目标 IP
- **WHEN** 已登录用户发起 SSH Skill 调用，但自己的台账中不存在目标 `ip`
- **THEN** 系统返回“未找到对应服务器台账”类错误
- **AND** 不执行任何远程命令

### Requirement: SSH Skill 保留命令安全校验
系统 MUST 在通过台账解析出凭据后，仍然对执行命令做安全过滤。

#### Scenario: 拦截危险命令
- **WHEN** 已登录用户发起 SSH Skill 调用，且 `command` 命中危险命令规则
- **THEN** 系统拒绝执行该命令
- **AND** 不发起 SSH 连接

## ADDED Requirements

### Requirement: SSH Skill User Confirmation
The system SHALL require user confirmation before executing any SSH command if the SSH skill is configured to require confirmation.

#### Scenario: SSH command requires confirmation
- **WHEN** the Agent attempts to execute an SSH command
- **THEN** the system checks if the SSH skill requires confirmation
- **AND** if so, returns a `CONFIRMATION_REQUIRED` response unless a valid confirmation token is provided

#### Scenario: SSH command execution after confirmation
- **WHEN** the Agent provides a valid confirmation token with the SSH command request
- **THEN** the system proceeds with the SSH execution

### Requirement: SSH Skill Server Name Support
The system SHALL support resolving server connection details using the server's `name` in addition to `ip`.

#### Scenario: Connect using server name
- **WHEN** the Agent provides a `host` parameter that matches a server `name` in the user's ledger
- **THEN** the system resolves the connection details using that ledger entry
