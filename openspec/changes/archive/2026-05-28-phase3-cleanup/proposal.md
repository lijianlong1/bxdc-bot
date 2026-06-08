## Why

Phase 1 和 Phase 2 已完成执行端点和 Agent 调用的统一收敛。当前 `java-skills.ts` 仍残留异步轮询代码（`executeConfiguredApiSkillAsync` + `postPollingAudit`），约 210 行，属于应移至 Gateway 的执行逻辑。前端 Skill 配置页三种类型（api/ssh/template）各硬编码一套表单，新增类型需要同时改前端。

Phase 3 完成收尾工作：异步轮询下沉 Gateway、前端配置页 Schema 驱动、Agent 最终精简。

## What Changes

- **Gateway** 异步轮询闭环：`POST /api/skills/execute` 内部检测 `asyncPoll` 配置 → 发起初始请求 → 提取 taskId → Scheduler 定时轮询 → 同步等待返回结果
- **Gateway** 新增 `GET /api/system-skills/execution-types` 端点，返回各类型的 configSchema，供前端动态渲染
- **Agent** 删除 `executeConfiguredApiSkillAsync` / `postPollingAudit` / 异步分派分支
- **Agent** 删除 `POST /api/skills/api/async` 及相关 async-tasks 调用
- **前端** 新增 `ConfigFormRenderer.vue` 通用组件，根据 Schema 的 `ui` 字段动态渲染控件
- **前端** `SkillManagementModal.vue` 改为调用 `ConfigFormRenderer`，删除硬编码表单代码

## Capabilities

### Modified Capabilities
- `agent-core-tool-execution`: 异步轮询代码从 Agent 删尽，~1700 行 → ~1500 行
- `frontend-skill-management`: 配置表单从硬编码改为 Schema 驱动渲染
- `gateway-async-polling`: 异步轮询从 Agent+Gateway 协作改为 Gateway 内部闭环

### New Capabilities
- `gateway-execution-types`: Gateway 执行类型注册端点，前端动态渲染配置表单

## Impact

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `backend/skill-gateway/.../service/SkillExecutionService.java` | 修改 | 增加异步轮询分支：检测 asyncPoll → 阻塞等待轮询完成 |
| `backend/skill-gateway/.../controller/SystemSkillController.java` | 新增 | `GET /api/system-skills/execution-types` 端点 |
| `backend/skill-gateway/.../controller/SkillController.java` | 删除 | 下线 `POST /api/skills/api/async` + `GET /async-tasks/{id}/wait` |
| `backend/agent-core/src/tools/java-skills.ts` | 删除 | `executeConfiguredApiSkillAsync` / `postPollingAudit` / 异步分派 |
| `frontend/src/components/SkillManagementModal.vue` | 重构 | 硬编码表单 → ConfigFormRenderer |
| `frontend/src/components/ConfigFormRenderer.vue` | **新建** | Schema 驱动的通用配置表单组件 |
