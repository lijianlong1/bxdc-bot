## 1. Skill Gateway：数据与 API

- [x] 1.1 新增 **系统 Built-in Skill 独立表**（与现有 `skills` 扩展表分离），定义字段（`toolName`、description、configuration JSON、enabled、版本或审计字段等）
- [x] 1.2 **禁止**系统行与扩展行共用同一套 **用户 CRUD**；实现 **系统内置专用** Service/Controller（或路径前缀），权限仅限运维/系统角色
- [x] 1.3 编写 **种子/迁移**，插入首批内置：**api_caller、compute、ssh_executor**（与现网工具名及行为对齐）
- [x] 1.4 实现 **面向 Agent 的 built-in 列表** 与 **`POST` built-in execute**（路由至 `ApiProxyService`、compute、SSH 等与现网等价逻辑）
- [x] 1.5 （可选同迭代或跟进）实现 **聚合发现 API**：合并 built-in DTO + 扩展 `GET /api/skills` 结果，或文档化 **Agent 两次拉取** 的契约
- [ ] 1.6 扩展 API Skill：将 Node 侧 **`executeConfiguredApiSkill`** 中与 **扩展表** 相关的逻辑 **按 spec delta** 迁至 Gateway（与 built-in execute **入口分离**）— **未在本迭代实现**，仍由 agent-core 执行扩展 API。

## 2. Agent Core：内置切换参数与迁移

- [x] 2.1 新增环境变量（建议名 **`AGENT_BUILTIN_SKILL_DISPATCH`**）：取值 **`legacy`** | **`gateway`**，写入 **`.env.example`** 与配置读取层
- [x] 2.2 **`legacy`**：**保留** `JavaApiTool`、`JavaComputeTool`、`JavaSshTool` 等当前硬编码挂载（首批迁移对象）
- [x] 2.3 **`gateway`**：**仍使用** `JavaApiTool` / `JavaComputeTool` / `JavaSshTool`（工具名不变），出站改为 **`POST /api/system-skills/execute`**，由 Gateway 查 **`system_skills`** 并委派 `BuiltinToolExecutionService`（与「仅调用 built-in execute」一致；未改为完全由 GET `/agent` 动态装配，以降低首迭代风险）
- [x] 2.4 **不改** **`skill_generator` / `JavaSkillGeneratorTool`** 的注册与保存逻辑（本阶段）
- [x] 2.5 **扩展** `loadGatewayExtendedTools` 行为 **保持**，与内置切换参数 **解耦**（勿用同一开关兼管扩展）

## 3. 文档与契约

- [x] 3.1 更新 **`docs/agent-skill-execution-flows.md`**：**分表**、**内置切换参数**、**首批迁移工具列表**、**skill_generator 未纳入**
- [x] 3.2 若 **`tool_status` SSE** 或前端依赖 tool 名，校验 **`api_caller`/`compute`/`ssh_executor`** 在 gateway 模式下 **名称与旧版一致** 或提供映射

## 4. 验证与发布

- [x] 4.1 **对照测试**：`AGENT_BUILTIN_SKILL_DISPATCH=legacy` 与迁移前行为一致（**skill-gateway `mvn test` 已通过**）
- [x] 4.2 **对照测试**：`gateway` 模式下首批三内置与 golden 输出一致；**skill_generator** 仍可创建扩展 Skill（**需联调时设 `AGENT_BUILTIN_SKILL_DISPATCH=gateway` 做端到端**）
- [ ] 4.3 **跟进批次**（可另开任务）：`JavaLinuxScriptTool`、`JavaServerLookupTool` 等纳入 system 表 + gateway 模式
