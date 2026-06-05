## Why

当前异步轮询 Skill 执行期间，SSE 心跳仅发送空注释（`:`）用于保活。用户在前端看不到任何轮询进展，只能等待最终完成/失败，期间完全黑盒。轮询可能需要数分钟，用户无法判断是卡住了还是在正常工作。

将每次心跳改为携带当前异步任务的最新轮询结果，并在前端以实时卡片形式展示，可以让用户看到轮询进度（状态、重试次数、已耗时、最近一次轮询返回），改善透明度和用户体验。

## What Changes

### skill-gateway

- **`TaskController`**：心跳回调从发送空注释改为查询当前对话关联的异步任务，发送 `polling_status` SSE 事件
- **`AsyncTaskMapper`**：新增 `findBySessionId(String sessionId)` 方法，按会话 ID 查询进行中的异步任务
- 心跳事件携带：`asyncTaskId`、`externalTaskId`、`status`、`retryCount`、`elapsedSeconds`、最后一次轮询的截断响应（`lastPollResponse`）

### 前端

- **`useChat.ts`**：新增 `polling_status` 事件处理，更新 `ToolInvocation` 的 `pollingStatus` 字段
- **UI**：工具调用卡片在"轮询中"状态下展示实时进度（状态标签、已耗时、重试次数、最近响应预览）

### 不变

- 心跳间隔保持 30 秒不变
- 心跳保活功能不变（SSE 连接稳定性不受影响）
- 轮询完成后的正常 `tool_status completed` 事件处理不变
- 不影响非异步轮询 Skill 的行为

## Capabilities

### New Capabilities

- `polling-status-ui`: 异步轮询 Skill 执行期间，SSE 心跳携带最新轮询进度，前端实时展示轮询状态、耗时和最近响应。

### Modified Capabilities

（无；纯增量功能，不改变任何现有能力。）

## Impact

| 文件 | 改动 |
|------|------|
| `TaskController.java` | 注入 `AsyncTaskPollingService`，心跳发送 `polling_status` 事件替代空注释 |
| `AsyncTaskMapper.java` | 新增 `findBySessionId(String sessionId)` 默认方法 |
| `AsyncTaskPollingService.java` | 新增 `findActiveBySessionId(String sessionId)` 方法 |
| `useChat.ts` | 新增 `polling_status` 事件分支，更新 ToolInvocation 状态 |
| 前端组件 | ToolInvocation 卡片展示轮询进度条/状态 |
