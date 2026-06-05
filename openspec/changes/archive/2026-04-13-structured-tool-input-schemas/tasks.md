## 1. 公共基础

- [x] 1.1 梳理 `java-skills.ts` 中仍使用 `extends Tool` + `_call(input: string)` 的类清单，确认各网关 POST body 字段形状
- [x] 1.2 约定 Zod 模块组织方式（同文件分段），并确保与 `DynamicStructuredTool` 泛型用法一致

## 2. 内置工具迁移（按依赖顺序）

- [x] 2.1 将 `JavaServerLookupTool` 迁移为 `DynamicStructuredTool`，schema：`name`（或与网关一致的字段）
- [x] 2.2 将 `JavaLinuxScriptTool` 迁移为结构化入参：`serverId`、`command`
- [x] 2.3 将 `JavaApiTool` 迁移为结构化入参：`url`、`method`、`headers`、`body`（类型与网关一致）
- [x] 2.4 将 `JavaSshTool` 迁移为结构化入参：`host`、`username`、`command`、`privateKey`/`password`、`confirmed` 等
- [x] 2.5 核对 `AgentFactory` / 工具列表注册处：绑定、类型守卫（`isStructuredTool`）与 trace 参数序列化无回归

## 3. skill_generator

- [ ] 3.1 为 `JavaSkillGeneratorTool` 定义 `targetType` 分支的 Zod schema（union / discriminated union）
- [ ] 3.2 将 `_call` 改为接收解析后的对象，复用现有 `buildGeneratedSkill`、`saveGeneratedSkill` 流程
- [ ] 3.3 验证 `INPUT_INCOMPLETE` 与 `missingFields` 在边界输入下仍符合预期

## 4. 验证

- [ ] 4.1 手动：各工具至少一次成功调用 + 一次故意错误参数（观察校验/错误信息）
- [ ] 4.2 `npm run build` / `tsc` 通过；必要时更新与 tool schema 相关的单元测试或快照
