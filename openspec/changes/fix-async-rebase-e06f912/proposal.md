## Why

`dc0302e refactor: 技能系统统一执行重构` 在合并后导致多处 async 逻辑失效：
- `AsyncTaskPollingScheduler.java` 从 388 行被精简到 263 行，失去 SINGLE_CALL/PERIODIC 双线程池分发与 `@PreDestroy` 资源清理
- agent-core 的 `if (config.asyncPoll)` Submit 原子被整体删除，LLM 被 async 任务阻塞
- `SkillExecutionService.executeApiSkillAsync` 改用 `CompletableFuture.get()` 同步等待结果，与 fire-and-forget 矛盾
- `java-skills.ts` 中 14 个 helper / type 缺失 `export`，导致 `skill-generator.ts` / `openclaw-executor.ts` 编译失败

这违反 `openspec/specs/api-extension-skill-llm-tool-call/spec.md` 第 60+ 行的 fire-and-forget 要求：
> - agent-core MUST NOT 同步调用 `/api/skills/async-tasks/{id}/wait` 阻塞 LLM
> - SINGLE_CALL → 立即返回 `status: "SINGLE_CALLED"`
> - PERIODIC → 立即返回 `status: "POLLING"`

## What Changes

完整 rebase 到 `e06f912`（pre-merge tip，PR #7 zhangzhuangsimida 分支）作为基底，线性 cherry-pick 后续 10 个 non-merge commit，并修复 5 处冲突 + 1 处整合问题。

核心 fix：
- **AsyncTaskPollingScheduler**: 恢复 e06f912 的 388 行双线程池版本（`periodicExecutor` 20 线程 + `singleCallExecutor` 缓存线程池），按 `pollStrategy` 分发，补回 `@PreDestroy` 清理
- **java-skills.ts asyncPoll Submit**: 完整保留（`if (config.asyncPoll)` → submit + 立即返回 `SINGLE_CALLED` / `POLLING`）
- **SkillExecutionService.executeApiSkillAsync**: 改写为 fire-and-forget —— 不调用 `registerFuture` / `future.get()`，submit 后立即返回状态 map
- **java-skills.ts exports**: 给 14 个标识符加 `export`（`formatToolError` / `GatewaySkill` / `parseSkillConfig` 等），让 split 模块化正常工作
- **loadGatewayExtendedTools options**: 加 `sessionId?: string` 字段

辅助：
- 备份旧 merge 拓扑版本为 `backup/pre-rebase-20260609-090349` tag
- 新线性历史 commit 在 `low-version` 分支（HEAD `2bd1b13`）
- 详细操作记录在 `docs/merge-report-rebase-async-fix.md`

## Capabilities

### New Capabilities
<!-- None - this is fixing existing capability implementation -->

### Modified Capabilities
- `api-extension-skill-llm-tool-call`: 实现修复 fire-and-forget 立即返回的 spec 行为（之前实现不满足 spec）

## Impact

- **后端 skill-gateway**: `AsyncTaskPollingScheduler.java`（恢复 388 行）、`SkillExecutionService.java`（executeApiSkillAsync 改写）
- **后端 agent-core**: `tools/java-skills.ts`（asyncPoll Submit 完整保留 + 14 个 export + sessionId 类型字段）、`agent/agent.ts`（无变化）
- **新增文件**: `docs/merge-report-rebase-async-fix.md`（合并报告）
- **备份**: `backup/pre-rebase-20260609-090349` tag
- **不涉及**: agent-core 异步逻辑核心（已正确，仅恢复被删除的部分）、前端通知中心 UI（完整保留）
- **BREAKING**: 无（fix 性质，恢复 spec 行为）
