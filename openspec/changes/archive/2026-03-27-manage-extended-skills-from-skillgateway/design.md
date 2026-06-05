## Context

当前系统中，Agent Core 的 Extended Skills 是硬编码在代码中的，这导致每次新增或修改 Skill 都需要重新编译和部署 Agent Core。同时，前端的 Skill Hub 虽然能够展示从 SkillGateway 获取的 Extended Skills，但缺乏对其进行增删改查的管理界面。为了提升系统的可扩展性和用户体验，我们需要将 Extended Skills 的管理完全动态化，由前端提供管理界面，SkillGateway 提供持久化和 API，Agent Core 动态拉取。

## Goals / Non-Goals

**Goals:**
- 前端实现 Extended Skills 的管理界面（增删改查、启停）。
- SkillGateway 提供完善的 CRUD 接口，并确保返回的数据结构满足 Agent Core 动态注册 Tool 的需求。
- Agent Core 在启动或运行时，能够通过调用 SkillGateway 的接口动态加载并注册 Extended Skills。

**Non-Goals:**
- 不改变 Built-in Skills 的核心执行逻辑。
- 不涉及 Skill 执行权限的细粒度控制（如基于角色的权限控制），仅实现全局的启停。

## Decisions

1. **前端管理界面入口**
   - **决定**：在现有的 Skill Hub 抽屉中增加“管理”按钮，点击后打开一个独立的管理弹窗或页面；或者直接在主界面增加一个“Skill 管理”入口。考虑到 Skill Hub 目前定位是展示，新增一个独立的“Skill 管理”入口或在 Skill Hub 中嵌入管理功能均可。为了保持界面简洁，决定在 Skill Hub 的 Extended Skills 区域增加一个“管理”按钮，点击打开管理弹窗。
   - **替代方案**：复用服务器台账的管理模式，在主界面增加独立入口。由于 Skill 管理属于高级功能，放在 Skill Hub 内部作为扩展功能更为合适。

2. **数据库初始化机制**
   - **决定**：移除 `SkillService.java` 中硬编码的 `ensureDefaultExtendedSkills()` 方法。改为使用 Spring Boot 标准的 `src/main/resources/data.sql` 文件进行数据库初始化。使用 `INSERT ... SELECT ... WHERE NOT EXISTS` 语法确保幂等性。
   - **理由**：符合 Spring Boot 最佳实践，实现数据与代码解耦，便于后续维护和扩展。

3. **Agent Core 动态加载机制**
   - **决定**：Agent Core 在初始化时，调用 SkillGateway 的 `GET /api/skills` 接口获取所有 `enabled=true` 且 `type='EXTENSION'` 的 Skills。根据 `configuration` 字段（JSON 格式）解析出具体的 Tool 参数（如 `kind`, `operation` 等），并动态注册到 Agent 的 Tool 列表中。
   - **替代方案**：每次处理用户请求时动态拉取。这会增加延迟，因此选择在初始化时拉取，并提供一个刷新机制（如定期轮询或提供刷新接口/指令）。

3. **SkillGateway 数据模型调整**
   - **决定**：现有的 `Skill` 实体已经包含了 `name`, `description`, `type`, `configuration`, `enabled` 等字段，基本满足需求。需要确保 `configuration` 字段能够灵活存储不同类型 Extended Skill 所需的元数据（如 JSON Schema）。

## Risks / Trade-offs

- **[Risk] Agent Core 与 SkillGateway 的网络通信失败** → **Mitigation**: Agent Core 启动时若拉取失败，应有重试机制，并允许在没有 Extended Skills 的情况下以基础能力启动。
- **[Risk] 动态加载的 Skill 配置格式错误** → **Mitigation**: Agent Core 在解析 `configuration` 时应增加健壮的错误处理，忽略解析失败的 Skill，并记录日志，不影响其他 Skill 的加载。
