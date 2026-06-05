## MODIFIED Requirements

### Requirement: 公共 Skill 的写授权策略

系统 SHALL 对 `PUBLIC` Skill 的 **更新与删除** 仅允许 **创建者**（`createdBy` 与当前请求用户标识一致）执行。`POST` 创建新 Skill 仍 MUST 将 `createdBy` 绑定为当前用户。非创建者对他人 `PUBLIC` Skill 的写请求 SHALL 返回与资源不存在一致的安全语义（例如 404），不得泄露该 Skill 存在或元数据。

#### Scenario: 创建者可更新自己的公开 Skill

- **WHEN** 用户 A 对 `visibility=PUBLIC` 且 `createdBy` 为用户 A 的 Skill 发起更新
- **THEN** 系统 MUST 允许该操作

#### Scenario: 创建者可删除自己的公开 Skill

- **WHEN** 用户 A 对 `visibility=PUBLIC` 且 `createdBy` 为用户 A 的 Skill 发起删除
- **THEN** 系统 MUST 允许该操作

#### Scenario: 非创建者不得修改他人公开 Skill

- **WHEN** 用户 B 尝试更新用户 A 创建的 `PUBLIC` Skill
- **THEN** 系统 MUST 拒绝该操作

#### Scenario: 非创建者不得删除他人公开 Skill

- **WHEN** 用户 B 尝试删除用户 A 的 `PUBLIC` Skill
- **THEN** 系统 MUST 拒绝该操作

## ADDED Requirements

### Requirement: 平台 public 作者行的固定管理员写权限

对 `visibility=PUBLIC` 且 `createdBy` 等于平台作者标识 `public`（与 `PLATFORM_PUBLIC_AUTHOR` 语义一致）的 Skill，系统 SHALL 额外允许 **固定管理员用户 ID `890728`**（与请求用户标识字符串相等）执行更新与删除。该管理员 ID SHALL 在实现中作为常量硬编码；**不得**依赖配置文件。管理员身份 **不得**用于修改 `createdBy` 为其他用户（含真实用户）的 Skill。

#### Scenario: 管理员可更新平台 public 行

- **WHEN** 请求用户 ID 为 `890728`
- **AND** 目标 Skill 的 `visibility` 为 `PUBLIC` 且 `createdBy` 为 `public`
- **THEN** 系统 MUST 允许更新

#### Scenario: 管理员可删除平台 public 行

- **WHEN** 请求用户 ID 为 `890728`
- **AND** 目标 Skill 的 `visibility` 为 `PUBLIC` 且 `createdBy` 为 `public`
- **THEN** 系统 MUST 允许删除

#### Scenario: 管理员不得凭 890728 修改他人创建的公开 Skill

- **WHEN** 请求用户 ID 为 `890728`
- **AND** 目标 Skill 的 `createdBy` 为用户 A（非 `public`）
- **THEN** 系统 MUST 拒绝写操作（与创建者不一致时的语义一致）

#### Scenario: 非 890728 不得写平台 public 行

- **WHEN** 请求用户 ID 不是 `890728`
- **AND** 目标 Skill 的 `createdBy` 为 `public`
- **THEN** 系统 MUST 拒绝写操作
