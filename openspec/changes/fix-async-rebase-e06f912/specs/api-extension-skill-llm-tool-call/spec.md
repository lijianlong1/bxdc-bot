## ADDED Requirements

### Requirement: AsyncTaskPollingScheduler 维护双线程池架构

后端 `AsyncTaskPollingScheduler` SHALL 维护两个独立的 ExecutorService：
- `periodicExecutor`: 固定 20 线程池，负责 PERIODIC 周期轮询任务
- `singleCallExecutor`: 缓存线程池，负责 SINGLE_CALL 单次长调用任务

#### Scenario: 按 pollStrategy 分发到对应线程池
- **WHEN** scheduler 从 `findPendingOrPollingTasks()` 拉取任务列表
- **AND** 任务的 `pollStrategy` 字段为 `SINGLE_CALL`
- **THEN** 系统 SHALL 提交任务到 `singleCallExecutor`
- **AND** 任务的 `pollStrategy` 字段为 `PERIODIC`
- **THEN** 系统 SHALL 提交任务到 `periodicExecutor`

#### Scenario: 进程关闭时正确清理线程池
- **WHEN** Spring 容器关闭（`@PreDestroy` 触发）
- **THEN** `periodicExecutor` SHALL 调用 `shutdown()`
- **AND** `singleCallExecutor` SHALL 调用 `shutdown()`
- **AND** 两个线程池 SHALL 等待已提交任务完成（`awaitTermination`）

### Requirement: agent-core asyncPoll Submit 原子保持 fire-and-forget 语义

agent-core 在调用带 `asyncPoll` 配置的 API Skill 时 SHALL：
1. 立即 submit 到 gateway `/api/skills/execute`（或直接到 async submit endpoint）
2. **不**同步等待 async 任务完成（**不**调用 `future.get()` / **不**轮询 `/api/async-tasks/{id}/wait`）
3. 立即返回 `status: "SINGLE_CALLED"` 或 `status: "POLLING"` 给 LLM

#### Scenario: SINGLE_CALL 模式 submit 立即返回
- **WHEN** LLM 调用带 `asyncPoll.pollStrategy = "SINGLE_CALL"` 的 API Skill
- **THEN** agent-core SHALL 立即返回 `status: "SINGLE_CALLED"`
- **AND** SHALL NOT 同步调用 `/api/async-tasks/{id}/wait` 阻塞 LLM

#### Scenario: PERIODIC 模式 submit 立即返回
- **WHEN** LLM 调用带 `asyncPoll.pollEndpoint` 的 API Skill（即 PERIODIC 模式）
- **THEN** agent-core SHALL 立即返回 `status: "POLLING"`
- **AND** SHALL NOT 同步调用 `/api/async-tasks/{id}/wait` 阻塞 LLM

### Requirement: SkillExecutionService.executeApiSkillAsync 不阻塞 gateway 线程

`SkillExecutionService.executeApiSkillAsync` SHALL 在 submit async 任务后立即返回，不调用 `CompletableFuture.get()` / `future.get(timeout)`。

#### Scenario: gateway 端 fire-and-forget 实现
- **WHEN** gateway 收到带 `asyncPoll` 的 API skill 执行请求
- **THEN** `executeApiSkillAsync` SHALL submit 任务到 `asyncTaskPollingService.createTask()`
- **AND** 立即返回 status map：`{status: SINGLE_CALLED | POLLING, taskId, externalTaskId, message}`
- **AND** SHALL NOT 调用 `asyncTaskPollingScheduler.registerFuture().get()`

#### Scenario: 后台轮询由 scheduler 接管
- **WHEN** async 任务被 submit 到 gateway
- **THEN** `AsyncTaskPollingScheduler.pollTasks()` SHALL 在后续 30s 周期内拉取并轮询该任务
- **AND** 任务状态变更（PENDING → POLLING → COMPLETED/FAILED/TIMEOUT）由 scheduler 写入 `async_tasks` 表
- **AND** 前端 SHALL 通过 `/api/async-tasks/my` 通知中心查询最新状态
