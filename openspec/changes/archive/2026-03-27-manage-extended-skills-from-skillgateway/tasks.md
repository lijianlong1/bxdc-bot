## 1. SkillGateway API 与数据库增强

- [x] 1.1 创建 `src/main/resources/data.sql`，将硬编码的 Skill 数据转移为 SQL 初始化脚本。
- [x] 1.2 移除 `SkillService.java` 中的 `ensureDefaultExtendedSkills()` 逻辑及相关调用。
- [x] 1.3 检查并确保 `SkillController` 提供了完整的 CRUD 接口（GET, POST, PUT, DELETE）。
- [x] 1.4 确保 `Skill` 实体和接口支持 `enabled` 字段的更新。
- [x] 1.5 编写或更新相关的单元测试，验证 CRUD 逻辑。

## 2. 前端 Skill 管理界面

- [x] 2.1 在 `SkillHub.vue` 的 Extended Skills 区域增加“管理”按钮。
- [x] 2.2 创建 `SkillManagementModal.vue` 组件，包含 Skill 列表和基本操作（编辑、删除、启停）。
- [x] 2.3 在 `SkillManagementModal.vue` 中实现新增/编辑 Skill 的表单表单（包含 Name, Description, Configuration JSON）。
- [x] 2.4 在 `useSkillHub.ts` 中增加对应的 API 调用方法（createSkill, updateSkill, deleteSkill）。
- [x] 2.5 联调前端与 SkillGateway 的 CRUD 接口。

## 3. Agent Core 动态加载机制

- [x] 3.1 修改 Agent Core 初始化逻辑，移除硬编码的 Extended Skills。
- [x] 3.2 增加启动时调用 SkillGateway `GET /api/skills` 的逻辑，筛选 `enabled=true` 且 `type='EXTENSION'` 的记录。
- [x] 3.3 实现 `configuration` JSON 的解析逻辑，将获取到的数据转换为 Agent 可识别的 Tool 对象。
- [x] 3.4 增加错误处理机制，确保拉取失败时 Agent 仍能以基础能力启动。
- [x] 3.5 编写或更新 Agent Core 相关的单元测试，验证动态加载和解析逻辑。
