## Why

Phase 1 已在 Skill Gateway 建立了统一的 `POST /api/skills/execute` 端点（含 HTTP 组装、确认门、kind 分派），并通过旧端点转调包装实现 Gateway 底层收敛。当前可验证新端点正常工作。

Phase 2 的目标是让 Agent Core 切到新端点，删除 `java-skills.ts` 中的 HTTP 组装、执行分派和确认判断逻辑，使 Agent 回归纯粹的 ReAct 编排。这是"轻 Agent、重 Gateway"的核心落笔点。

## What Changes

- **修改** `java-skills.ts`：`DynamicStructuredTool.func` 不再做执行分派和 HTTP 组装，统一调 Gateway `POST /api/skills/execute`
- **删除** `java-skills.ts` 中 9 个函数/逻辑块（HTTP 组装、kind 分派、确认判断、currentTime 执行）
- **修改** `agent.controller.ts`：确认流适配——从"自己读 requiresConfirmation 后 interrupt"改为"检测 Gateway 返回的 CONFIRMATION_REQUIRED 后 interrupt"
- **修改** `agent.ts`：工具注册逻辑中删除 `api_caller` 相关引用（已暂停默认注册，类保留供调试）
- **删除** Gateway 中 4 个旧端点：`POST /api/skills/api`、`/api/skills/ssh`、`/api/skills/linux-script`、`/api/skills/compute`

## Capabilities

### Modified Capabilities
- `agent-core-tool-registration`: Agent Core 的工具注册和调用逻辑，从自定义多端点调用改为统一 `/execute` 端点
- `agent-confirmation-flow`: 确认流的触发方式，从 Agent 自判改为读取 Gateway 返回

## Impact

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `backend/agent-core/src/tools/java-skills.ts` | **大幅删减** | ~1100 行执行逻辑删除，保留校验和 OPENCLAW |
| `backend/agent-core/src/agent/agent.ts` | **简化** | 工具注册引用清理 |
| `backend/agent-core/src/controller/agent.controller.ts` | **修改** | 确认流适配 CONFIRMATION_REQUIRED 来源 |
| `backend/skill-gateway/.../controller/SkillController.java` | **删除** | 下线 4 个旧端点方法 |
| `backend/skill-gateway/.../config/SecurityConfig.java` | **修改** | 移除旧端点放通规则 |
