## 1. 基础设施与 Zod 工厂

- [x] 1.1 在 `java-skills.ts`（或独立模块）中新增「按 `ExtendedSkillConfig` / `kind` 构建 Zod schema」的工厂函数；SSH 使用固定 `name`/`serverName` schema；API 优先 JSON Schema → Zod 或过渡期宽松 Zod + 文档说明
- [x] 1.2 将 `loadGatewayExtendedTools` 中 `DynamicTool` 改为 `DynamicStructuredTool`，每个 skill 实例绑定对应 Zod 与 `func` 分发
- [x] 1.3 调整 `recoverDynamicToolInputFromRunConfig`、`buildConfirmedToolInputString`、extended skill 确认流，使 `interrupt`/`resume` 与结构化 `toolCall.args` 一致

## 2. 执行路径

- [x] 2.1 重构 `executeServerResourceStatusSkill`：支持对象化入参；禁止裸别名 `JSON.parse`；`command` 仅 `config.command`；兼容 `name`/`serverName`/`host` 与 server-lookup
- [x] 2.2 保持 `executeConfiguredApiSkill` 中 Ajv 合并后校验；将 StructuredTool 传入的 args 规范化为 `normalizeApiSkillPayload` 输入；**移除** `REQUIRE_PARAMETERS` / 渐进披露分支，工具描述一次性暴露全量参数与说明
- [x] 2.3 处理 `template` / `OPENCLAW` 扩展分支的 Zod 与入参传递（与现有 `executeOpenClawSkill`、template 分支对齐）

## 3. Skill 生成器

- [x] 3.1 更新 `skillGeneratorToolInputSchema` / `buildGeneratedSkill` / `JavaSkillGeneratorTool` 描述与保存逻辑，使生成 API/SSH 配置与 Structured 运行时一致（SSH 不暴露可覆盖 command 的 tool 字段）
- [x] 3.2 为生成器输出补充可审计元数据（如 API 的 `parameterContract` 完整性、SSH 台账字段说明），与 `built-in-skill-generation` delta 一致

## 4. Agent 与测试

- [x] 4.1 更新 `agent.controller`（或等价）中扩展 Skill 路由说明：不再强调单一 `input` 信封
- [x] 4.1b **普通用户会话**绑定工具列表时 **不挂载** `ssh_executor`（可选：管理员/调试/环境变量放行）；远程 SSH 仅通过扩展 SSH 类 Skill
- [x] 4.2 更新/新增 `java-skills` 相关单测与扩展 Skill 集成测试（结构化 tool 调用、SSH 别名；**不再**测 `REQUIRE_PARAMETERS` 渐进披露）
- [ ] 4.3 （可选）前端 Skill 管理/Hub 文案：说明扩展 API/SSH 使用结构化参数

## 5. 收尾

- [x] 5.1 本地或 CI 跑通 agent-core 测试与关键路径 smoke
- [x] 5.2 归档前检查 `openspec/specs` 下 delta 与 `proposal`/`design` 一致
