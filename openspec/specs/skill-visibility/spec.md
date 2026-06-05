# skill-visibility Specification

## Purpose

定义数据库 Skill 的公共/私人可见性、创建者归属、SkillGateway 列表与 CRUD 授权、Built-in 与新建默认值，以及 Agent 与前端的一致性要求。

## Requirements

### Requirement: Skill 持久化可见性与创建者

系统 SHALL 为每条数据库 Skill 持久化 **可见性**（`PUBLIC` 或 `PRIVATE`）与 **创建者标识**（`createdBy`，与平台用户身份一致），使列表与授权逻辑可以按用户裁切。

#### Scenario: 新建 Skill 写入可见性与创建者

- **WHEN** 已认证用户创建一条新的数据库 Skill（非 Built-in 种子路径）
- **THEN** 系统 MUST 将 `createdBy` 设为当前登录用户标识
- **AND** 可见性 MUST 遵循「默认私人」规则（见下条 Requirement）；若用户显式选择了公共或私人，则 MUST 持久化该选择

#### Scenario: 历史数据迁移默认值

- **WHEN** 系统读取迁移前已存在的 Skill 记录
- **THEN** 该类记录 MUST 具有兼容的默认可见性（例如 `PUBLIC`）
- **AND** `createdBy` 可为空或由迁移策略填充，且不得导致列表接口抛错

### Requirement: Built-in Skills 为公共且作者为 public

平台 SHALL 将所有 **Built-in Skills**（Skill Hub「Built-in」区块展示的内置能力，以及 Agent 侧与之对应的内置工具；不包含用户扩展库中的数据库 Skill 条目）视为 **公共** 能力。其归属作者 SHALL 使用固定标识 `public`（实现可与系统用户或迁移占位一致，但对外语义为平台公共作者），且 Built-in SHALL NOT 被建模为某一真实用户的 `PRIVATE` Skill。

#### Scenario: 内置能力语义为公共

- **WHEN** 系统展示或加载 Built-in Skills
- **THEN** 其可见性语义 MUST 为公共（`PUBLIC` 或等价产品表述）
- **AND** 其作者/归属 MUST 呈现或持久化为 `public`，而非当前登录用户

#### Scenario: 内置技能不表现为他人私人扩展

- **WHEN** 用户查看 Skill Hub 或 Agent 可用工具列表
- **THEN** Built-in Skills MUST NOT 出现在「仅本人可见的私人扩展」语义下
- **AND** 用户不得将 Built-in 占为己有或改为 `PRIVATE`（若界面无编辑入口则自然满足；若有元数据编辑则 MUST 拒绝将内置改为私人）

#### Scenario: 持久化或种子行与 public 作者

- **WHEN** 某 Built-in 能力在数据库或配置中存在对应记录
- **THEN** 该记录的可见性 MUST 为 `PUBLIC`
- **AND** `createdBy`（或等价归属字段）MUST 为 `public`

### Requirement: 新建数据库 Skill 默认私人

用户通过管理界面、API 或生成链路 **新建** 一条数据库 Skill 时，若未显式指定可见性，系统 SHALL 默认持久化 `visibility=PRIVATE`。

#### Scenario: 未指定可见性时默认为私人

- **WHEN** 已认证用户新建数据库 Skill 且请求中未包含可见性字段或未作显式选择
- **THEN** 系统 MUST 持久化 `visibility=PRIVATE`

#### Scenario: 显式选择公共后保存为公共

- **WHEN** 用户在新建流程中显式选择「公共」
- **THEN** 系统 MUST 持久化 `visibility=PUBLIC`
- **AND** `createdBy` MUST 仍为当前登录用户（公共 Skill 的创建者可为真实用户，与 Built-in 的 `public` 作者区分）

#### Scenario: 生成工具未指定可见性时默认私人

- **WHEN** 生成类路径保存新 Skill 且未传入可见性
- **THEN** 系统 MUST 默认 `visibility=PRIVATE`

### Requirement: SkillGateway 列表按当前用户过滤

SkillGateway SHALL 在返回 Skill 列表（含 Agent 与前端消费的聚合列表）时，仅包含对 **当前请求用户** 可见的记录：`PUBLIC` 全体，以及 `PRIVATE` 且 `createdBy` 等于当前用户。

#### Scenario: 用户可见公共与本人私人 Skill

- **WHEN** 用户 A 请求 Skill 列表
- **THEN** 响应包含所有 `PUBLIC` Skill
- **AND** 响应包含用户 A 创建的 `PRIVATE` Skill
- **AND** 响应不包含用户 B 的 `PRIVATE` Skill

#### Scenario: 未登录或匿名请求的可见集合

- **WHEN** 列表接口在无用户身份上下文下被调用（若产品允许）
- **THEN** 系统 MUST 仅返回 `PUBLIC` Skill 或按统一策略拒绝请求（实现与网关约定一致，且须在任务中固化）

### Requirement: 私人 Skill 的读与写授权

系统 MUST 禁止非创建者通过 API 读取、更新或删除他人名下的 `PRIVATE` Skill；对越权请求 SHALL 返回与资源不存在一致的安全语义（例如 404），不得泄露私人 Skill 的元数据。

#### Scenario: 越权读取他人私人 Skill

- **WHEN** 用户 B 尝试通过标识符获取用户 A 的 `PRIVATE` Skill 详情
- **THEN** 系统 MUST 拒绝该操作
- **AND** 不得返回该 Skill 的名称、描述或配置内容

#### Scenario: 越权修改他人私人 Skill

- **WHEN** 用户 B 尝试更新或删除用户 A 的 `PRIVATE` Skill
- **THEN** 系统 MUST 拒绝该操作

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

### Requirement: 生成类路径绑定创建者

经 Skill **生成工具**（含 built-in 生成器、API 描述生成等）写入 SkillGateway 的记录 MUST 将 `createdBy` 设为 **当前登录用户**，并 MUST 遵守本变更对可见性与列表过滤的规则。

#### Scenario: 生成工具保存 Skill

- **WHEN** 当前登录用户通过生成工具成功保存一条新 Skill
- **THEN** 持久化记录中的 `createdBy` MUST 等于该用户
- **AND** 默认可见性 MUST 为 `PRIVATE`（除非用户或请求显式指定其他值；与「新建数据库 Skill 默认私人」一致）
