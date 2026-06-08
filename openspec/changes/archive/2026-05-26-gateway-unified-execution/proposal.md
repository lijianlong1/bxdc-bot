## Why

当前 Skill Gateway 的底层执行端点存在冗余——SSH 执行有 3 个入口（`/api/skills/ssh`、`/api/skills/linux-script`、`/api/system-skills/execute`），HTTP API 执行有 2 个入口（`/api/skills/api`、`/api/system-skills/execute`），它们底层调用完全相同的 `BuiltinToolExecutionService` 方法。冗余根因为历史遗留的 `AGENT_BUILTIN_SKILL_DISPATCH` 环境变量（`legacy` vs `gateway`）导致同一底层服务暴露了两套入口。

另一方面，按照"轻 Agent、重 Gateway"的架构原则，Skill 的 HTTP 请求组装（URL 拼接、Header 合并、Body 构造、parameterBinding 路由）和执行分派（根据 kind 决定执行方式）不应在 Agent Core 中完成，而应下沉到 Gateway。后续 Phase 2 和 Phase 3 将逐步改造 Agent Core，Phase 1 先在 Gateway 建立统一执行能力，使 Agent 侧改造时可平滑切换。

## What Changes

- **新增** `POST /api/skills/execute` 统一执行端点，接收 `{ skillId, parameters }` 格式请求
- **新增** Gateway 侧 HTTP 请求组装逻辑（URL/Header/Body 拼接、parameterBinding 路由）
- **新增** Gateway 侧确认门逻辑（判断 `requiresConfirmation` → 两段短连接确认流）
- **新增** 参数默认值合并逻辑（从 `parameterContract.properties.*.default` 读取）
- **新增** 确认状态内存存储（`ConcurrentHashMap`）及过期清理
- **修改** 现有冗余执行端点内部转调至新的 `/execute`，Gateway 底层收敛为唯一执行路径

## Capabilities

### New Capabilities
- `gateway-unified-skill-execution`: Skill Gateway 统一执行端点与执行分派能力

### Modified Capabilities
- 无。本次变更仅在 Gateway 新增能力，不修改现有业务逻辑。该 Phase 内 Agent Core 不做任何改动。

## Impact

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `SkillController.java` | 新增 | `POST /api/skills/execute` 端点 + 旧端点转调包装 |
| `SkillExecutionService.java` | **新建** | HTTP 请求组装 + kind 路由 + 确认门 + 参数默认值合并 |
| `PendingConfirmationStore.java` | **新建** | 内存确认状态管理（`ConcurrentHashMap` + 定时过期清理） |
| `BuiltinToolExecutionService.java` | 修改 | 执行路径统一经过 `SkillExecutionService` |
| `SecurityConfig.java` | 修改 | 放通新端点路径 |
