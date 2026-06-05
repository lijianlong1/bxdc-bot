# Tasks: fix-async-task-dedup-and-timezone

## 1. dedup scheduler 竞态

- [x] 1.1 修 [AsyncTaskMapper.java#L17-L27](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java#L17-L27) `findPendingOrPolling`：in-list 从 `("PENDING","POLLING","SINGLE_CALLED")` 改为 `("PENDING","POLLING")`
- [x] 1.2 写注释说明 SINGLE_CALLED 由线程 claim、不应被 scheduler 重新扫到；卡死由 StartupRecoveryRunner 兜底
- [x] 1.3 修 [AsyncTaskPollingScheduler.java#L65-L67](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java#L65-L67) 派发日志从 DEBUG 升 INFO，打印 id/strategy/status
- [x] 1.4 重启 gateway，跑长 GET，验证 upstream 只收到 1 次请求（Task 9 60s 任务现在只插 1 条 NETWORK_REQUEST）

## 2. elapsedSeconds 终态冻结

- [x] 2.1 修 [AsyncTaskPollingService.java#L221-L229](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingService.java#L221-L229) 终态用 `completedAt` 冻结 elapsed，运行中用 `now()` 实时增长
- [x] 2.2 加 `if (elapsed < 0) elapsed = 0;` 防御 `completedAt < startedAt` 异常

## 3. canonicalizeJson String body 解析

- [x] 3.1 修 [RequestSignatureUtil.java#L70-L88](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/util/RequestSignatureUtil.java#L70-L88) String 形态首尾是 `{}` / `[]` 时尝试按 JSON 解析后规范化；解析失败按原样
- [x] 3.2 行为保持向后兼容：不是 `{}` / `[]` 形态的 String（含 raw body）依然原样返回

## 4. 时区链路收口（3 处 `NOW()` 漏改）

- [x] 4.1 修 [AsyncTaskMapper.java#L65](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java#L65) `markRead` 的 `NOW()` → `UTC_TIMESTAMP()`（上次 edit 没生效，本次确认）
- [x] 4.2 修 [AsyncTaskMapper.java#L113-L119](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java#L113-L119) `recoverStuckSingleCallTasks` 的 3 个 `NOW()`（`completed_at`、`updated_at`、WHERE 间隔判断）
- [x] 4.3 修 [AsyncTaskMapper.java#L24](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java#L24) `findPendingOrPolling` 的 polling 间隔判断 `NOW()` → `UTC_TIMESTAMP()`

## 5. 诊断日志

- [x] 5.1 [SkillController.java#L265-L271](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java#L265-L271) `[callApiAsync] dedup-check`：user / session / method / url / bodyType / bodyPreview / idJsonPath / pollMethod / pollEndpoint / sig
- [x] 5.2 [java-skills.ts#L1620](file:///Users/dccb/botproject/bxdc-bot/backend/agent-core/src/tools/java-skills.ts#L1620) `[executeConfiguredApiSkillAsync] submit`：user / session / method / url / bodyType / bodyPreview / sig-pre

## 6. 验证

- [x] V.1 长 GET 60s：upstream 只收到 1 次请求（network_request 审计 1 条）
- [x] V.2 终态任务 elapsedSeconds 不再随时间增长
- [x] V.3 dashboard `/api/async-tasks/my` 显示的任务耗时正确（不再出现 1m → 2m 漂移）
- [x] V.4 三个服务全部跑新代码：skill-gateway (18080, PID 79948) / agent-core (3000, PID 76137) / frontend (5173)
