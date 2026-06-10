# Design — Async rebase 修复

## 策略选择

完整 rebase 到 `e06f912`（pre-merge tip，PR #7 zhangzhuangsimida），而非仅 revert `dc0302e`。原因：
1. 用户的 pre-merge 架构有精细的 async / dedup / 通知中心设计，revert 单个 commit 不够
2. 用户希望保留所有 post-merge 的改进（feat(skill-editor) / sql 集中化 / docs / .m2 仓库）
3. 线性历史比 merge 拓扑更清晰（用户后续手动 push 需要 force，但自己的 fork 可以）

## rebase 执行流程

```
e06f912 (基底)
  ↓ cherry-pick 3479f7c refactor(技能系统统一执行重构)
    ↓ cherry-pick 33e5506/1814c8c/443a28c/ab21555/cafa6c5/8fd0355/c886c34/77dbe6d docs+chore+feat
      ↓ cherry-pick e94cd9e fix(useChat)
        ↓ cherry-pick 9ee3b6c fix(async 整合)
```

合并 commit `963c484` / `dcba967` / `b2d5fb2` / `8637f6c` 跳过——它们的内容已通过 cherry-pick 覆盖。

## Cherry-pick 冲突解决

### dc0302e refactor 冲突（5 处）

| 文件 | 策略 | 行数差异 |
|------|------|---------|
| `AsyncTaskPollingScheduler.java` | **取 ours (e06f912)** | 388 vs 263 |
| `java-skills.ts`（4 处冲突区，最大 832 行） | **取 ours (e06f912)** | +832 行 asyncPoll Submit |
| `SkillController.java` | **取 theirs (dc0302e)** | +279 行统一执行入口 |
| `SkillManagementModal.vue` | **取 theirs (dc0302e)** | +164 行 schema 驱动渲染 |
| `useChat.ts` | **取 theirs (dc0302e)** | 后续 cherry-pick `e94cd9e` 再补 sessionId |

### 整合冲突（2 处）

| 文件 | 问题 | 修复 |
|------|------|------|
| `SkillExecutionService.executeApiSkillAsync` | 调用 `registerFuture(taskId)` 然后 `future.get(maxWaitSeconds)` 阻塞 | 改写为 fire-and-forget：submit + 立即返回 status map，移除 registerFuture 调用 |
| `java-skills.ts` 14 个标识符 | 没 `export`，skill-generator.ts 无法 import | 加 `export` 关键字 |
| `loadGatewayExtendedTools options` | 缺 `sessionId?` 字段 | 加字段 |

## fire-and-forget 实现细节

`SkillExecutionService.executeApiSkillAsync` 修改前：
```java
asyncTaskPollingService.createTask(task);
CompletableFuture<String> future = asyncTaskPollingScheduler.registerFuture(task.getId());
String result = future.get(maxWaitSeconds + 30, TimeUnit.SECONDS);  // ❌ 阻塞
return parseResult(result);
```

修改后：
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

注：`updateStatusAndLastPolled` 把状态从 PENDING → POLLING，让前端通知中心立即可见。

## 不引入新的依赖 / env 变量（AGENTS.md 7.1, 7.2）

修复完全用 JDK 17 / Spring Boot 自带工具：
- `MessageDigest` (SHA-256, 已存在) for dedup
- `@Scheduled` + `ExecutorService` for polling
- `CompletableFuture` 移除而非新增

## 验证矩阵

| 验证项 | 命令 | 结果 |
|--------|------|------|
| frontend | `npm run build` | ✅ 0 errors |
| skill-gateway | `mvn compile` | ✅ BUILD SUCCESS |
| agent-core | `npx tsc --noEmit` | ✅ exit=0 |
| agent-core 测试 | 6 个 `node test/*.cjs` | ✅ 全通过 |
| 服务探活 | 3 个端口 HTTP 200 | ✅ |
| /api/async-tasks/my (3 用户) | curl | ✅ 200 |
| /api/skills/execute (POST) | curl | ✅ 57ms 响应 |

## Push 说明

myfork 远端仍在 merge 拓扑版本（8cd8dc7），本地已重写为线性（2bd1b13）：

```bash
git push myfork low-version --force  # 必须 --force
```

AGENTS.md 6 说 GitHub 推送限流常见，建议 sleep 30-60s 重试。远端 GitHub 网络在本会话期间持续 hang，push 推迟到用户手动执行。

## 回退方案

备份 tag `backup/pre-rebase-20260609-090349` 保留旧 merge 拓扑版本。如本次 rebase 引入未发现的 regression：

```bash
git checkout backup/pre-rebase-20260609-090349  # 回退到旧版本
# 或
git revert 9ee3b6c..2bd1b13  # 局部回退
```
