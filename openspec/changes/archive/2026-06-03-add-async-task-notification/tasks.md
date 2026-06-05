## 1. 数据库

- [ ] 1.1 在 `schema-mysql.sql` 中给 `async_tasks` 表添加 `notified_at DATETIME DEFAULT NULL` 列
- [ ] 1.2 添加索引 `idx_async_user_unread (user_id, status, notified_at)`
- [ ] 1.3 同步 Java 实体 `AsyncTask.java` 加 `notifiedAt` 字段及 getter/setter
- [ ] 1.4 在 `AsyncTaskMapper.java` 中补充 `selectByUserAndStatus` / `updateNotifiedAt` 方法

## 2. 后端 Service

- [ ] 2.1 在 `AsyncTaskPollingService` 中新增方法：
  - `List<AsyncTask> findByUser(String userId, boolean unreadOnly, int limit)`
  - `int countUnreadByUser(String userId)`
  - `void markRead(Long taskId, String userId)`
- [ ] 2.2 引入 `skillName` 字段（联表 skills 取 name），加 DTO `AsyncTaskNotificationDto`

## 3. 后端 Controller

- [ ] 3.1 新建 `AsyncTaskNotificationController` 路径 `/api/async-tasks`
  - `GET /my?unreadOnly=&limit=`
  - `GET /my/unread-count`
  - `POST /{id}/ack`
- [ ] 3.2 从 `X-User-Id` header 提取 userId（复用现有约定）
- [ ] 3.3 在 `TaskController` SSE 完成回调处，对 status=COMPLETED/FAILED 的任务设置 `notified_at = NULL`（不显式标，默认 NULL 即未读）
- [ ] 3.4 在 `GET /my` 实现中加自动清理：用户查询时把 `status IN (COMPLETED,FAILED) AND notified_at IS NULL AND completed_at < NOW() - 7 days` 的项同步 UPDATE 为 `notified_at = NOW()`，避免历史堆积噪声
- [ ] 3.5 后端接口只返回"该用户 + 该 Skill 走 asyncPoll 分支创建"的任务（按 `user_id` + `skill_id` 在 skills 表里有 `asyncPoll` 配置的双重条件过滤；不依赖此过滤则改用 `poll_endpoint IS NOT NULL` 的简单条件）

## 4. 前端 Composable

- [ ] 4.1 新建 `frontend/src/composables/useAsyncTaskNotifications.ts`
  - 导出 `unreadCount`、`tasks`、`loadTasks`、`acknowledge`、`startPolling`、`stopPolling`
- [ ] 4.2 通过 `useUser` 获取当前 userId
- [ ] 4.3 API 调用走 `services/api.ts`，base URL 复用

## 5. 前端组件

- [ ] 5.1 新建 `frontend/src/components/TaskNotificationBell.vue`（铃铛 + badge）
- [ ] 5.2 新建 `frontend/src/components/TaskNotificationDrawer.vue`（抽屉列表）
  - 状态 chip 颜色映射：PENDING=灰、POLLING=蓝、COMPLETED=绿、FAILED=红、TIMEOUT=橙
  - 进度条（POLLING 状态显示 `pollResponseCount / maxResponses` 估算）
  - 列表项点击 → 调 `acknowledge` + 关闭抽屉 + 跳转
- [ ] 5.3 在 `Layout.vue` 顶栏 user-info 前插入 `<TaskNotificationBell />`
- [ ] 5.4 `Layout.vue` 挂载时 `startPolling(30_000)`，卸载时 `stopPolling`

## 6. 路由 & 消息联动

- [ ] 6.1 路由 `/chat/:sessionId?taskId=xxx` 支持 `taskId` query
- [ ] 6.2 聊天页面挂载时检测 `taskId`，把对应任务的 `previewResult` 插入当前 assistant 消息的 toolInvocations
- [ ] 6.3 自动滚动到对应消息

## 7. 测试

- [ ] 7.1 后端单测：用户 A 看不到用户 B 的任务
- [ ] 7.2 后端单测：`markRead` 后 unread-count 减少
- [ ] 7.3 前端 dev 自测：触发一个长轮询任务 → 离开页面 → 重新进入 → 看到徽标 + 抽屉列表

## 8. 文档

- [ ] 8.1 更新 `openspec/specs/api-gateway.md`（如存在）记录新端点
- [ ] 8.2 更新 `frontend/openspec/...`（如存在）记录新组件
