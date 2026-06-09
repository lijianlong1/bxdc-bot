# Merge Report — Async 修复 + 完整 rebase e06f912

> 日期：2026-06-09
> 操作者：AI agent (bxdc-bot 维护)
> 备份 tag：`backup/pre-rebase-20260609-090349`
> 新分支：`rebase-clean`（已 fast-forward 到 `low-version`）

## 1. 背景

合并 `dc0302e refactor: 技能系统统一执行重构` 后，多处 async 逻辑失效：

| 问题 | 现象 | 影响 |
|------|------|------|
| `AsyncTaskPollingScheduler.java` 从 388 行被精简到 263 行 | 失去 SINGLE_CALL/PERIODIC 双线程池分发，缺 `@PreDestroy` 清理 | 长调用阻塞周期轮询，进程关闭时资源泄漏 |
| `agent-core` 的 `if (config.asyncPoll)` Submit 原子被整体删除 | agent-core 调 `/api/skills/execute` 后**同步等结果** | LLM 被 async 任务阻塞，不符合 spec 的 fire-and-forget |
| `SkillExecutionService.executeApiSkillAsync` 用 `CompletableFuture.get()` 阻塞 | 即使 agent-core 想 fire-and-forget，gateway 端也被阻塞 | 同一问题 |
| `java-skills.ts` 14 个 helper / type 没 `export` | `skill-generator.ts` / `openclaw-executor.ts` 无法 import | tsc 14 个错误 |
| `loadGatewayExtendedTools options` 缺 `sessionId` | agent.ts 传 `sessionId` 编译失败 | tsc 错误 |

`openspec/specs/api-extension-skill-llm-tool-call/spec.md` 第 60+ 行要求：
> - agent-core MUST NOT 同步调用 `/api/skills/async-tasks/{id}/wait` 阻塞 LLM
> - SINGLE_CALL → 立即返回 `status: "SINGLE_CALLED"`
> - PERIODIC → 立即返回 `status: "POLLING"`
> - 前端 SHALL NOT 出现"转圈圈等待任务完成"

合并后的代码不满足 spec。

## 2. 策略

完整 rebase 到 `e06f912`（pre-merge tip，PR #7 zhangzhuangsimida 分支）作为基底，线性 cherry-pick 后续 10 个 non-merge commit：

```
9ee3b6c  fix(async): 修复 cherry-pick 后的 async 整合问题    ← 新增 fix
e94cd9e  fix(frontend): 补 useChat 类型定义
77dbe6d  feat(skill-editor): 恢复异步轮询 SINGLE_CALL 策略的配置 UI
c886c34  chore: 将建表语句集中到 sql/ 目录
8fd0355  fix(schema): 移除 async_tasks 表中不存在的 session_id 索引列
cafa6c5  docs: 更新测试清单
ab21555  chore(skill-gateway): 项目内 .m2 仓库 + settings.xml
443a28c  docs: 合并测试清单
1814c8c  docs: 合并报告 - low-version ← hebing
33e5506  docs: 添加 low-version ← main 合并方案文档
3479f7c  refactor: 技能系统统一执行重构
e06f912  Merge pull request #7 from zhangzhuangsimida/low-version  ← 基底
```

合并 commit（963c484 / dcba967 / b2d5fb2 / 8637f6c）跳过——它们的内容已通过 cherry-pick 覆盖。

## 3. Cherry-pick 冲突解决

### 3.1 dc0302e refactor（5 处冲突）

| 文件 | 策略 | 原因 |
|------|------|------|
| `AsyncTaskPollingScheduler.java` | **取 ours (e06f912)** | 388 行双线程池版本是用户的精细设计 |
| `java-skills.ts`（4 处冲突区，最大 832 行） | **取 ours (e06f912)** | asyncPoll Submit 原子是 spec 必须的 |
| `SkillController.java` | **取 theirs (dc0302e)** | 重构的统一执行入口 |
| `SkillManagementModal.vue` | **取 theirs (dc0302e)** | 重构的 schema 驱动渲染 |
| `useChat.ts` | **取 theirs (dc0302e)** | 后续 cherry-pick `8cd8dc7 fix` 会再补 sessionId |

`frontend/dist/*` 全删（AGENTS.md 1：dist 不进 git）。

### 3.2 fix(async) 整合 commit `9ee3b6c`

cherry-pick 完成后，编译失败两处：

**A) `SkillExecutionService.java:497` 找不到 `registerFuture`**

dc0302e 的 `SkillExecutionService.executeApiSkillAsync` 调用 `asyncTaskPollingScheduler.registerFuture(taskId)`，但我们取了 e06f912 的 388 行 scheduler，没有 `registerFuture` 方法。

修复：改写 `executeApiSkillAsync` 为 fire-and-forget（无需 registerFuture / future.get）：
```java
asyncTaskPollingService.createTask(task);
asyncTaskPollingService.updateStatusAndLastPolled(task.getId(), "POLLING");
return Map.of(
  "status", pollStrategy.equals("SINGLE_CALL") ? "SINGLE_CALLED" : "POLLING",
  "taskId", task.getId(),
  "externalTaskId", externalTaskId,
  "message", "任务在后台运行，结果会出现在通知中心"
);
```

**B) `java-skills.ts` 14 个 export 缺失**

`skill-generator.ts` / `openclaw-executor.ts` 需要从 `java-skills.ts` import 大量 helper，但 e06f912 版本没 export。

加 `export` 关键字到 14 个标识符：
- `formatToolError`, `GatewaySkill`, `SkillMutationPayload`, `ExtendedSkillConfig`, `AsyncPollConfig`
- `readPreset`, `normalizeParameterBindingValue`, `normalizeParameterContractRequired`
- `normalizeExtendedConfig`, `sanitizeConfigForDisplay`, `normalizeGeneratedOperation`
- `gatewaySkillMutationHeaders`, `gatewaySkillReadHeaders`, `parseSkillConfig`

**C) `loadGatewayExtendedTools options` 缺 `sessionId`**

加字段：
```ts
options?: {
  plannerModel?: any;
  availableTools?: BindableAgentTool[];
  /** Session id passed to gateway execute endpoint (used for audit/confirmation/async task) */
  sessionId?: string;
};
```

## 4. 验证

### 4.1 Build

| 项 | 命令 | 结果 |
|----|------|------|
| frontend | `npm run build` | ✅ 0 errors（chunk-size 警告无关） |
| skill-gateway | `mvn compile` | ✅ BUILD SUCCESS |
| agent-core | `npx tsc --noEmit` | ✅ exit=0 |

### 4.2 测试

| 项 | 结果 |
|----|------|
| agent-core 6/6（java-skills.loader / skill-manager-routing / tasks-state / prompts-static-system / history-sanitize / logger.service） | ✅ 全通过 |
| skill-gateway surefire 12 个 | ⏸️ maven-surefire-plugin 不在 .m2，本地离线无法下载（环境限制） |

### 4.3 服务端到端

| 端点 | 状态 |
|------|------|
| 18080 skill-gateway | ✅ java listening |
| 3000 agent-core | ✅ node listening |
| 5173 frontend Vite | ✅ HTTP 200 |
| 18080 `/api/skills` (X-User-Id: 151515) | ✅ HTTP 200，2 skills |
| 18080 `/api/async-tasks/my`（3 个用户） | ✅ HTTP 200 |
| 18080 `POST /api/skills/execute` | ✅ 57ms 返回（fire-and-forget 路径） |

### 4.4 架构完整性

| 关键文件 | 状态 |
|----------|------|
| `AsyncTaskPollingScheduler.java` | 388 行 ✓（双线程池 + `@PreDestroy`） |
| `java-skills.ts asyncPoll Submit` | ✓ `if (config.asyncPoll)` 完整保留 |
| `RequestSignatureUtil.java` | ✓ SHA-256 dedup 签名 |
| `DedupConfig.java` | ✓ 60s / 3600s 窗口配置 |
| `AsyncTaskNotificationController.java` | ✓ 通知中心 endpoint |
| `TaskNotificationBell.vue` (569 行) | ✓ 前端通知 UI |
| `useAsyncTaskNotifications.ts` (235 行) | ✓ 30s 轮询 + mark-read + batch-delete |

## 5. spec 一致性

按 `openspec/specs/api-extension-skill-llm-tool-call/spec.md`：

| spec 要求 | 现状 |
|-----------|------|
| SINGLE_CALL 立即返回 `SINGLE_CALLED` | ✓ `executeApiSkillAsync` 返回 `status: SINGLE_CALLED` |
| PERIODIC 立即返回 `POLLING` | ✓ 同上返回 `status: POLLING` |
| 不阻塞 LLM | ✓ 无 `future.get()` / 无同步等 |
| 前端无转圈圈 | ✓ `updateStatusAndLastPolled` 后立即释放 |
| 通知中心 `/api/async-tasks/my` 实时反映 | ✓ 30s 轮询 + `unread-count` |
| audit log 记录 `fireAndForget: true` 和 `pollStrategy` | ✓ 由 `AsyncTaskPollingScheduler` 在 `extraJson` 写入 |

## 6. 备份

| 项 | commit / tag |
|----|-------------|
| 旧 merge 拓扑版本 | `backup/pre-rebase-20260609-090349`（指向 8cd8dc7，含 b2d5fb2 / dcba967 / 8637f6c merge commits） |
| 新线性历史 | `9ee3b6c` (low-version = rebase-clean) |
| 重回旧版 | `git checkout backup/pre-rebase-20260609-090349` |
| 删除 rebase-clean | `git branch -D rebase-clean`（保留 low-version 即可） |

## 7. Push 说明

myfork 远端 (`lijianlong1/bxdc-bot.git`) 的 `low-version` 还在 merge 拓扑版本（8cd8dc7），本地已重写为线性（9ee3b6c）。

推送命令：
```bash
git push myfork low-version --force
```

`--force` 是必须的。AGENTS.md 6 说 GitHub 推送限流常见，建议 sleep 30-60s 重试。
