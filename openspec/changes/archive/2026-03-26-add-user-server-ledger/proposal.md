## Why

当前系统虽然已经具备 SSH Skill 和 SkillHub 的基础能力，但服务器连接信息仍未形成面向用户的台账模型，无法做到“每个用户拥有独立服务器列表并由系统托管登录信息”。新增服务器台账能力后，可以把服务器凭据集中保存在 Java 数据库中，并让 SSH Skill 在执行时自动解析当前用户名下服务器的登录信息，从而提升可用性、隔离性与后续维护效率。

## What Changes

- 在 Java Skill Gateway 中新增按用户隔离的服务器台账能力，持久化保存服务器 `ip`、`username`、`password`
- 为服务器台账提供查看、创建、编辑、删除等维护接口，并限制用户只能访问自己的台账数据
- 调整 SSH Skill 执行链路，执行时不再直接依赖调用方传入完整登录信息，而是根据用户选择或指定的服务器记录解析目标连接
- 在前端增加“服务器台账”入口按钮，支持查看当前用户的服务器列表，并提供新增、编辑、删除等维护操作
- 明确服务器台账与用户身份的关联关系，确保登录用户之间的数据彼此隔离

## Capabilities

### New Capabilities

- `server-ledger-management`: 定义按用户隔离的服务器台账数据模型、CRUD 接口、访问控制和持久化要求
- `server-ledger-ui`: 定义前端服务器台账入口、列表展示和维护交互
- `server-ledger-ssh-resolution`: 定义 SSH Skill 执行时如何从当前用户的服务器台账中解析连接信息并完成访问约束

### Modified Capabilities

（无。该变更引入新的服务器台账能力与 SSH 解析能力，不直接修改现有已归档 capability 的 requirement。）

## Impact

- **backend/skill-gateway**: 需要新增服务器台账 entity、repository、service、controller，以及 SSH Skill 的台账解析逻辑
- **backend/agent-core**: 可能需要更新 SSH Skill 的输入契约或调用描述，使其与服务器台账选择方式一致
- **frontend**: 需要新增服务器台账入口、列表视图、维护表单与调用接口
- **Database**: 需要新增服务器台账表，并建立与用户的关联关系，保存连接凭据
- **Security**: 需要保证用户只能访问自己的台账记录，并限制 SSH Skill 只能使用当前用户名下的服务器
