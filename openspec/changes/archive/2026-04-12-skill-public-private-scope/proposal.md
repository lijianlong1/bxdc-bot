## Why

当前数据库 Skill 在平台内为全局共享：任意登录用户都能看到并编辑同一份 Skill 列表，无法区分「平台公共能力」与「个人实验/私有工具」。同时，通过生成类工具产出的 Skill 未与创建者绑定，存在误改他人配置与列表噪声问题。需要在数据模型与产品行为上引入「公共 / 私人」可见范围，并将生成路径创建的 Skill 归属到当前登录用户。

## What Changes

- **产品定案**：所有 **Built-in Skills**（Skill Hub 内置区块及 Agent 侧对应内置能力）均为 **公共** Skill，归属作者为固定标识 **`public`**（实现可为系统用户或字面量，语义为平台公共作者），不得表现为真实用户的私人 Skill。
- **产品定案**：用户 **新建** 数据库 Skill（含管理界面、API、生成链路）时，若未显式指定可见性，**默认**为 **私人**（`PRIVATE`）；用户可显式改为公共。
- 为 Skill 增加可见性维度（例如 `PUBLIC` / `PRIVATE`）与创建者标识（`createdBy` / `ownerUserId` 等，实现阶段命名以设计为准）。
- Skill 新增与编辑表单支持选择类型「公共」或「私人」，且新建时 **默认选中私人**；**私人** Skill 仅创建者可在管理界面查看与编辑；公共 Skill 按现有管理语义对具备权限的用户开放（若后续有管理员角色，可在实现中扩展）。
- SkillGateway 列表、详情、更新、删除等接口按当前登录用户过滤「可读的私人 Skill」并允许创建者维护自己的私人 Skill；未授权访问私人他人记录时返回与「不存在」一致的安全语义。
- Agent Core / 动态发现：`GET /api/skills`（或等价聚合接口）仅向当前会话用户暴露 **公共 Skill + 当前用户私人 Skill**，避免 Agent 加载到其他用户的私人工具。
- 通过 **Skill 生成工具**（含 built-in 生成器、API 描述生成等）写入数据库的 Skill **必须**记录为当前登录用户创建；未指定可见性时 **默认私人**（与上条「新建默认私人」一致）。

## Capabilities

### New Capabilities

- `skill-visibility`：定义 Skill 可见性枚举、创建者字段、持久化与迁移策略、SkillGateway CRUD/列表的授权规则，以及 Agent 侧加载范围与未授权行为。

### Modified Capabilities

- `skill-discovery`：扩展「从 SkillGateway 拉取 Skill」的场景，要求仅注册对当前用户可见的 Skill（公共 + 本人私人）。
- `skill-management-editor`：新增/编辑流程中必选或可选「公共/私人」控件，以及私人 Skill 仅创建者可编辑的约束。
- `skill-hub-ui`：Skill Hub 与管理列表仅展示当前用户有权查看的扩展 Skill；私人 Skill 对他人不可见。
- `extended-skill-management`：管理列表与操作与可见性、创建者一致；非创建者不得编辑他人私人 Skill。
- `api-skill-generation`：生成并持久化时绑定当前用户为创建者，并符合 `skill-visibility` 的默认可见性与保存规则。
- `built-in-skill-generation`：经生成工具保存到 SkillGateway 的 Skill 归属当前登录用户，并符合可见性与列表规则。

## Impact

- **后端**：`skill-gateway` 实体与迁移、`SkillController`/`SkillService`、鉴权上下文中的 `userId`；可能涉及初始化数据与历史 Skill 的默认可见性（例如视为公共或迁移为系统用户）。
- **前端**：Skill 管理表单、Skill Hub 列表、与 Skill 相关的 API 客户端字段。
- **Agent Core**：拉取 Skill 列表时的用户身份传递（若当前已带用户令牌则复用）。
- **兼容性**：**BREAKING** 对 API 响应与数据库 schema 的扩展；旧客户端若忽略新字段，服务端需提供合理默认值并文档化。
