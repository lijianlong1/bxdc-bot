## 1. 提示词资源与类型

- [x] 1.1 在 `backend/agent-core/src/prompts/types.ts` 的 `SystemPrompts` 中新增 `agentRolePrompt: string`
- [x] 1.2 在 `backend/agent-core/src/prompts/zh.ts` 中实现中文 `agentRolePrompt`（身份、职责、工作方式、能力边界简述）
- [x] 1.3 在 `backend/agent-core/src/prompts/en.ts` 中实现英文 `agentRolePrompt`，与中文语义对齐
- [x] 1.4 确认 `prompts/index.ts` 在 `zh` / `en` / 默认回退路径下均能暴露 `agentRolePrompt`

## 2. 控制器消息装配

- [x] 2.1 在 `backend/agent-core/src/controller/agent.controller.ts` 的 `runTask` 中，将 `agentRolePrompt` 与 `Prompts.skillGeneratorPolicy`、`extendedSkillRoutingPolicy`、`taskTrackingPolicy`、`confirmationUIPolicy` 拼接为 `staticSystemPrompt`（顺序与 design 一致）
- [x] 2.2 将 `messages` 构造为：首条为 `{ role: 'system', content: staticSystemPrompt }`，其次为 `validHistory`，最后为 `{ role: 'user', content: userTurnContent }`，其中 `userTurnContent` 仅包含 `skillContext`、`memoryContext`（若有）与 `User Instruction:\n${instruction}`，不再重复四条策略
- [x] 2.3 核对 `sanitizeHistoryForAgent` 与 `allowedHistoryRoles` 仍满足需求；若历史中含 `system`，评估是否与新增首条 system 冲突并文档化

## 3. 验证与文档

- [x] 3.1 手动或通过现有测试：无任务状态与有任务状态（触发 `preModelHook`）两种路径下 Agent 可完成一轮 `stream`
- [x] 3.2 若存在针对 `runTask` / prompt 拼接的单测，更新或新增断言（至少覆盖 `messages[0].role === 'system'` 且含角色关键词）
- [x] 3.3 在 `docs/` 或 agent 相关开发说明中简要记录「system = 角色 + 策略，user = 技能上下文 + 记忆 + 用户指令」（若项目已有类似文档则最小增量）
