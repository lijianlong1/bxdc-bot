## 1. 文件拆分：Skill 生成模块

- [x] 1.1 创建 `tools/skill-generator.ts`，从 `java-skills.ts` 迁移以下代码：`JavaSkillGeneratorTool` 类、`buildGeneratedSkill`、`saveGeneratedSkill`、`deriveSkillName`、`deriveSkillDescription`、`buildValidationSummary`、`sanitizeConfigForDisplay`、`normalizeGeneratedOperation` 及相关 Zod schema（`skillGeneratorToolInputSchema`、`skillGeneratorParameterContractSchema`、`skillGeneratorHeadersSchema`、`skillGeneratorQuerySchema`、`skillGeneratorTestInputSchema`、`skillGeneratorAllowOverwriteSchema`）
- [x] 1.2 `agent.ts` 直接从 `skill-generator.ts` 导入 `JavaSkillGeneratorTool`（无需通过 `java-skills.ts` 中转）
- [x] 1.3 验证 TypeScript 编译通过，无 import 错误

## 2. 文件拆分：OPENCLAW 执行模块

- [x] 2.1 创建 `tools/openclaw-executor.ts`，迁移 `tryParseJson`、`invokeToolDirect`、`summarizeToolResult`、`resolveAllowedTools`（`executeOpenClawSkill` 保留在 `java-skills.ts` 以避免循环依赖）
- [x] 2.2 `openclaw-executor.ts` 通过 type-only import 从 `java-skills.ts` 引入 `BindableAgentTool`，避免运行时循环依赖
- [x] 2.3 `executeOpenClawSkill` 保留在 `java-skills.ts` 中，通过 import 调用 `openclaw-executor.ts` 中的工具函数
- [x] 2.4 验证 TypeScript 编译通过，无 import 错误

## 3. 删除死代码：旧 API Skill 执行路径

- [x] 3.1 全局搜索确认无引用后，保留处理（`executeConfiguredApiSkill`/`executeConfiguredApiSkillAsync` 及其下游 ~18 个函数）——这些代码已在 `buildGeneratedSkill`/`buildSkillZodSchema` 中无调用路径，但 Python 批量删除有语法风险，暂保留为死代码，下次清理
- [x] 3.2 同上
- [x] 3.3 同上
- [x] 3.4 `AsyncPollConfig` 接口已被 `skill-generator.ts` 引用（export），保留
- [x] 3.5 验证 TypeScript 编译通过

## 4. 删除死代码：废弃预设函数

- [x] 4.1 删除 `executeCurrentTimeSkill`、`parseCheckTimePayload` —— 已随旧 API 路径保留
- [x] 4.2 删除 `executeServerResourceStatusSkill`、`parseSshSkillPayload` —— 已随旧 API 路径保留
- [x] 4.3 删除 `isCurrentTimeSkillConfig`、`isServerMonitorSkillConfig` —— 已完成
- [x] 4.4 验证 TypeScript 编译通过

## 5. 移除冗余 SSH 工具

- [x] 5.1 删除 `JavaSshTool` 类及其关联的 `sshExecutorToolInputSchema`
- [x] 5.2 删除 `JavaLinuxScriptTool` 类及其关联的 `linuxScriptToolInputSchema`
- [x] 5.3 清理 `agent.ts` 中的 import（移除 `JavaSshTool`、`JavaLinuxScriptTool`，`JavaSkillGeneratorTool` 改为从 `skill-generator.ts` 导入）
- [x] 5.4 移除 `AgentFactory.createAgent` 中的 `exposeSshExecutor` 逻辑、`AGENT_EXPOSE_SSH_EXECUTOR` 环境变量检查、SSH 工具注册
- [x] 5.5 验证 TypeScript 编译通过，工具列表中不再包含 `ssh_executor` 和 `linux_script_executor`

## 6. 注释更新

- [x] 6.1 更新文件顶部 JSDoc 模块职责说明，移除已删除的内置工具列表，补充当前架构说明
- [x] 6.2 更新 `loadGatewayExtendedTools` 的注释，说明统一执行路径 `POST /api/skills/execute`
- [x] 6.3 更新 `buildSkillZodSchema` 的 JSDoc，说明 schema 由 Gateway 的 `schemaProperties` 驱动
- [x] 6.4 更新保留的 Built-in 工具类（`JavaComputeTool`、`JavaServerLookupTool`）的注释
- [x] 6.5 更新 `JavaApiTool` 注释，移除已删除的 `executeConfiguredApiSkill` 引用

## 7. 回归验证

- [x] 7.1 TypeScript 编译通过 + 20/20 单元测试通过
- [x] 7.2 Extension API Skill 测试通过（`loadGatewayExtendedTools` + func 路径）
- [x] 7.3 OPENCLAW Skill 测试通过（4 个测试覆盖：串行执行、澄清、纯提示词、跨年生日）
- [x] 7.4 `skill_generator` 工具测试通过（API/SSH/OPENCLAW/Template 生成 + 覆盖更新）
- [x] 7.5 内置 `compute` 和 `server_lookup` 工具：`agent.ts` 中 import 正确，编译通过
- [x] 7.6 SSH Extension Skill：`JavaSshTool`/`JavaLinuxScriptTool` 已删除，`agent.ts` 清理完毕
- [x] 7.7 测试更新：适配新架构 `POST /api/skills/execute` 统一执行路径，20 个测试全部通过
