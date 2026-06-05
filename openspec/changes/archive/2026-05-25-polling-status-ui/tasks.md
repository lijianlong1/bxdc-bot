## 1. skill-gateway — AsyncTaskMapper 扩展

- [ ] 1.1 在 `AsyncTaskMapper.java` 中新增 `default List<AsyncTask> findBySessionId(String sessionId)` 方法
  - 条件：`eq("session_id", sessionId)` + `in("status", "PENDING", "POLLING")`
  - 按 `created_at` 升序

## 2. skill-gateway — AsyncTaskPollingService 扩展

- [ ] 2.1 新增 `findActiveBySessionId(String sessionId)` 方法，委托到 `asyncTaskMapper.findBySessionId(sessionId)`

## 3. skill-gateway — TaskController 心跳改造

- [ ] 3.1 注入 `AsyncTaskPollingService` 和 `AsyncPollingAuditService`（如尚未注入）
- [ ] 3.2 心跳回调改为：
  - 调用 `asyncTaskPollingService.findActiveBySessionId(sessionId)`
  - 若列表为空 → 发送空注释 `:`
  - 若列表非空 → 对每个任务：
    - 从 `AsyncPollingAuditLog` 查询最近一条 `phase=NETWORK_REQUEST` 的 `response_body`（截断至 500 字符）
    - 组装 JSON 并通过 `SseEmitter.event().name("polling_status").data(json)` 发送
  - 需要引入 `ObjectMapper` 序列化 JSON（如已存在则复用）
- [ ] 3.3 心跳 JSON 结构（单任务）：
  ```json
  {
    "type": "polling_status",
    "asyncTaskId": 1,
    "externalTaskId": "abc123",
    "status": "POLLING",
    "retryCount": 3,
    "elapsedSeconds": 45,
    "lastPollResponse": "{ ... truncated ... }"
  }
  ```
- [ ] 3.4 多任务时用数组 `tasks` 包裹
- [ ] 3.5 `elapsedSeconds` 取 `startedAt != null ? ChronoUnit.SECONDS.between(startedAt, now) : 0`

## 4. 前端 — useChat.ts 事件处理

- [ ] 4.1 新增 `isPollingStatusEvent(data)` 工具函数：检查 `data.type === "polling_status"`
- [ ] 4.2 在 `EventSource.onmessage` 中新增 `polling_status` 分支：
  - 提取任务列表中每个任务的 `asyncTaskId`
  - 构建 `toolId = "async_${asyncTaskId}"`
  - 创建或更新 `ToolInvocation`（`kind: "skill"`, `status: "running"`）
  - 设置 `pollingStatus` 字段
- [ ] 4.3 `ToolInvocation` 接口新增可选字段 `pollingStatus?: PollingStatus`
- [ ] 4.4 `PollingStatus` 类型定义：
  ```typescript
  interface PollingStatus {
    status: string;
    retryCount: number;
    elapsedSeconds: number;
    lastPollResponsePreview?: string;
  }
  ```

## 5. 前端 — 工具调用卡片 UI

- [ ] 5.1 在 `ToolInvocation` 卡片中检测 `pollingStatus` 是否非空
- [ ] 5.2 轮询中状态展示：
  - `t-tag` 标签："轮询中 (第 {retryCount} 次)" 或 "等待首次轮询"（retryCount=0）
  - 耗时：`formatElapsed(elapsedSeconds)` → `mm:ss`
  - 最近响应：`t-collapse` 可折叠面板，标题 "最近一次轮询响应"，内容为 `lastPollResponsePreview`
- [ ] 5.3 `tool_status completed/failed` 到达时，清除 `pollingStatus`，展示最终结果

## 6. 验证

- [ ] 6.1 本地启动前后端，创建异步轮询 Skill 并执行
- [ ] 6.2 观察浏览器 Network 面板中 SSE 事件流，每隔 30s 出现 `event: polling_status`
- [ ] 6.3 确认页面工具调用卡片实时显示轮询次数、耗时、最近响应预览
- [ ] 6.4 确认轮询完成后卡片回退为正常结果展示
- [ ] 6.5 确认心跳保活仍正常（无 SSE 断连）
- [ ] 6.6 服务器部署后 nginx 代理场景验证
