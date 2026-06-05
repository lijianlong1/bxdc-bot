# Fix: 异步任务 dedup 竞态 + 终端状态 elapsedSeconds 不冻结 + 时区链路漏网

## Why

在 `support-async-task-long-running` 归档后（见 `archive/2026-06-04-support-async-task-long-running`）的实际联调中，又发现 4 个 bug：

1. **dedup scheduler 竞态**（最严重）：`AsyncTaskPollingScheduler` 每 30s 扫一次任务，`findPendingOrPolling` 把 `SINGLE_CALLED` 也放在 in-list 里。SINGLE_CALL 任务跑 30s~10min 期间，scheduler 在下一个 tick 又扫到它、派发第二个线程并发调 upstream → 用户看到同一 GET 被调 N 次。
2. **elapsedSeconds 终态不自冻**：用 `startedAt → LocalDateTime.now()` 计算耗时，任务 COMPLETED/FAILED/TIMEOUT 之后耗时还在随时间增长，让人误以为任务重新被调用。
3. **canonicalizeJson String body 不解析**：`body` 传 String 时原样返回；LLM 一次传 Map 一次传 JSON 字符串时签名会漂移，dedup 漏掉。
4. **时区链路还剩 3 处 `NOW()`** 没改成 `UTC_TIMESTAMP()`：`markRead`、`recoverStuckSingleCallTasks`（3 处）、`findPendingOrPolling` 的 polling 间隔判断。原子 5 那次的 edit 部分没生效。

附带：
- `SkillController.callApiAsync` 加 dedup-check 诊断日志（user / session / method / url / bodyType / bodyPreview / sig）
- `agent-core/tools/java-skills.ts` 的 `executeConfiguredApiSkillAsync` 加 submit 诊断日志
- `AsyncTaskPollingScheduler.pollTasks` 派发日志从 DEBUG 升 INFO

## What Changes

- **fix(async-task)**: `findPendingOrPolling` 移除 `SINGLE_CALLED`，scheduler 不再并发 dispatch 同一长调用任务。SINGLE_CALL 任务的"卡死"由 `StartupRecoveryRunner` 兜底。
- **fix(async-task)**: `elapsedSeconds` 终态用 `completedAt` 冻结，运行中用 `now()` 实时增长。
- **fix(async-task)**: `RequestSignatureUtil.canonicalizeJson` 对 `{}` / `[]` 形态的 String 尝试按 JSON 解析后再规范化，避免 LLM 传 Map vs String 的签名漂移。
- **fix(timezone)**: 收口 3 处漏改的 `NOW()` → `UTC_TIMESTAMP()`。
- **chore(observability)**: dedup-check 与 submit 端各加一行诊断日志，方便后续排查。
