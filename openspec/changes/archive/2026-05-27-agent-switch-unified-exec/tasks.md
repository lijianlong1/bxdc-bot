## 1. Agent Core — `DynamicStructuredTool.func` 简化

- [x] 1.1 修改 `loadGatewayExtendedTools` 中生成的 `DynamicStructuredTool.func`
  - OPENCLAW 保留原逻辑，不走 `/execute`
  - 其余 CONFIG Skill 统一调 `POST {gatewayUrl}/api/skills/execute`
- [x] 1.2 适配确认流
  - `func` 收到 `{ status: "CONFIRMATION_REQUIRED", requestId }` 时触发 interrupt
  - 移除 `applyExtendedSkillConfirmationGate` 调用
  - resume 后带 `confirmed: true, requestId` 重新调 Gateway
- [x] 1.3 HTTP 组装函数不再被 func 调用
  - `normalizeParameterBindingValue` / `collectMergedScalarFields` / `toQueryRecord` / `buildUrlWithQuery` / `mergeHeadersForApiProxy` / `mergeJsonBodyForProxy` 保留在文件中但执行路径不再使用
- [x] 1.4 执行分派函数不再被 func 调用
  - `executeConfiguredApiSkill` / `executeCurrentTimeSkill` 保留但 func 不再调用
  - kind 分派分支（`if kind === 'api'` / `'ssh'` / `'template'`）已从 func 移除
- [x] 1.5 保留不动的函数
  - `buildExtendedSkillZodSchema` / `collectParameterDefaults` / `normalizeApiSkillPayload`
  - Ajv 校验逻辑 / `executeOpenClawSkill` / `loadGatewayExtendedTools`

## 2. Agent Core — 确认流适配

- [x] 2.1 `agent.controller.ts` 无需修改（现有 interrupt 处理已兼容 `kind: "extended_skill_confirmation"`）
- [x] 2.2 `buildConfirmedToolArgs` 保留，func 内确认恢复逻辑直接重调 Gateway
- [x] 2.3 `applyExtendedSkillConfirmationGate` 已从 func 移除，确认判断来源改为 Gateway 返回

## 3. Gateway — 旧端点下线

- [x] 3.1 删除 `POST /api/skills/api` 端点方法
- [x] 3.2 删除 `POST /api/skills/ssh` 端点方法
- [x] 3.3 删除 `POST /api/skills/linux-script` 端点方法
- [x] 3.4 删除 `POST /api/skills/compute` 端点方法
- [x] 3.5 SecurityConfig 无需修改（旧端点方法已删除，框架自动 500）
- [x] 3.6 `POST /api/skills/api/async` 保留（Phase 3 处理）

## 4. Agent Core — 引用清理

- [x] 4.1 `agent.ts` 中 `JavaApiTool` 注释和引用无需清理（已暂停默认注册，注释已说明）
- [x] 4.2 `AGENT_BUILTIN_SKILL_DISPATCH` 引用保留（async 路径仍使用）

## 5. 编译与回归测试

- [x] 5.1 Agent Core 编译通过：`npm run build` ✅
- [x] 5.1 Gateway 编译通过：`mvn compile` ✅
- [x] 5.2 API Skill：发消息 → LLM 调扩展 API Skill → Gateway `/execute` → 返回结果
- [x] 5.3 SSH Skill：发消息 → LLM 调扩展 SSH Skill → Gateway 台账解析 → SSH 执行
- [ ] 5.4 Template Skill：LLM 调用 → Gateway 返回 prompt → 正常展示
- [x] 5.5 确认流：带 `requiresConfirmation` 的 Skill → 弹确认框 → 用户操作 → 执行/取消
- [ ] 5.6 OPENCLAW：LLM 调用 → 子规划 → 多工具编排（不受影响，验证通过）
- [ ] 5.7 旧端点不可用：curl 调 `/api/skills/api`、`/api/skills/ssh` 返回 404

