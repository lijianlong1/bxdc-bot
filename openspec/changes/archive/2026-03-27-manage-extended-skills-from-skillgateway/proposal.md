## Why

当前系统中的 Extended Skills 是在 Agent Core 中硬编码注册的，缺乏灵活性。同时，前端的 Skill Hub 虽然展示了 Extended Skills，但用户无法通过界面进行新增和维护。为了实现 Skill 的动态扩展和管理，我们需要将 Extended Skills 的读取逻辑改为通过接口从 SkillGateway 的数据库中获取，并在前端提供录入和维护 Extended Skills 的功能。

## What Changes

- **修改 Agent Core 的 Skill 加载逻辑**：Agent 启动或初始化时，不再使用硬编码的 Extended Skills 列表，而是通过调用 SkillGateway 的 API (`GET /api/skills`) 获取并注册可用的 Extended Skills。
- **扩展前端 Skill Hub 功能**：在现有的 Skill Hub 界面（或新增专门的管理页面）中，增加 Extended Skills 的新增、编辑、删除和启停功能。
- **完善 SkillGateway 的 API**：确保 `SkillController` 提供的 CRUD 接口能够满足前端的维护需求，并返回完整的 Skill 元数据供 Agent Core 使用。

## Capabilities

### New Capabilities
- `extended-skill-management`: 前端提供对 Extended Skills 的增删改查及启停管理界面。

### Modified Capabilities
- `skill-discovery`: 修改 Agent Core 发现和加载 Extended Skills 的机制，改为通过接口从 SkillGateway 获取。

## Impact

- **Agent Core**：移除硬编码的 Extended Skills，增加启动时或运行时的 Skill 动态加载逻辑。
- **Frontend**：修改 `SkillHub.vue` 或新增管理页面，增加表单和交互逻辑以调用后端的 CRUD 接口。
- **Backend (SkillGateway)**：可能需要调整 `Skill` 实体或接口，确保返回的数据结构（如 `configuration` 或新增的 schema 字段）能够被 Agent Core 正确解析为可执行的 Tool。
