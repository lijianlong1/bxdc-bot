## 架构概览

```
┌──────────────────────┐         ┌────────────────────┐
│  Layout.vue 顶栏      │  轮询   │  /api/async-tasks  │
│  🔔 Badge (count)    │ ──────▶ │  /my/unread-count  │
│  ┌──────────────┐    │  30s    └────────────────────┘
│  │ Notification │    │              ▲
│  │  Drawer      │    │              │
│  └──────────────┘    │              │
│         │ 列表渲染   │              │
│         ▼            │              │
│  /api/async-tasks/my │ ───────────┘
│  ?unreadOnly=true    │
└──────────────────────┘

┌──────────────────────┐
│ skill-gateway        │
│  AsyncTaskController │
│   - GET  /my         │ ◀── userId header
│   - GET  /my/unread-count
│   - POST /{id}/ack   │
└──────────────────────┘
         │
         ▼
   MySQL.async_tasks
   + notified_at DATETIME NULL
```

## 数据库变更

```sql
ALTER TABLE async_tasks
  ADD COLUMN notified_at DATETIME DEFAULT NULL
  COMMENT 'NULL 表示尚未读；非 NULL 表示用户已查看时间';

CREATE INDEX idx_async_user_unread
  ON async_tasks (user_id, status, notified_at);
```

`notified_at = NULL` 即"未读"。

## 后端 API

### `GET /api/async-tasks/my?unreadOnly={bool}&limit={int}`

请求头：`X-User-Id: <userId>`（复用现有 user header 约定）

响应：
```json
{
  "items": [
    {
      "id": 123,
      "skillId": 5,
      "skillName": "get_daily_news",
      "externalTaskId": "ext-abc",
      "status": "POLLING",
      "retryCount": 2,
      "elapsedSeconds": 47,
      "pollResponseCount": 8,
      "errorMessage": null,
      "startedAt": "2026-06-01T10:00:00",
      "completedAt": null,
      "createdAt": "2026-06-01T10:00:00",
      "notifiedAt": null,
      "sessionId": "session-uuid",
      "previewResult": null
    }
  ]
}
```

### `GET /api/async-tasks/my/unread-count`

响应：`{ "count": 3 }`

### `POST /api/async-tasks/{id}/ack`

把 `notified_at = NOW()` 标记为已读。

## 前端组件

### `useAsyncTaskNotifications` composable
- `unreadCount: Ref<number>`
- `tasks: Ref<AsyncTaskNotification[]>`
- `pollUnreadCount(): Promise<void>` — 30s 一次调用
- `loadTasks(unreadOnly: boolean): Promise<void>`
- `acknowledge(id: number): Promise<void>`

### `TaskNotificationDrawer.vue`
- 顶栏铃铛旁的抽屉
- `t-drawer` + `t-list` 渲染任务列表
- 状态 chip（颜色对应状态）
- 点击项 → 调 `acknowledge` + 跳转到 `/chat/:sessionId?taskId=xxx`

### `Layout.vue` 集成
- 顶栏最后（在 `user-info` 之前）插入 `<TaskNotificationBell />`
- 全局 `useAsyncTaskNotifications` 单例；layout 挂载时启动轮询，卸载时停止

## 兼容性

- `notified_at` 列新增有默认值 NULL，对历史 `async_tasks` 记录保持中性（不影响现有功能）。
- 数据迁移脚本对历史未读任务**不**自动回填 `notified_at = NOW()`，避免一次性把几个月前的旧任务全推给用户。
- 通知系统**只看"Skill 配置了 asyncPoll 才创建的记录"**——而 asyncPoll 自始至终是同一个创建路径，所以历史数据 vs 新数据行为一致：只要走 asyncPoll 分支就会进通知列表。
- 老任务（`status=COMPLETED` 但 `notified_at IS NULL`）算"未读"。建议在前端首次加载时给"超过 7 天的 COMPLETED/FAILED 且 notified_at IS NULL"的项**自动标已读**（避免用户登录后看到历史堆积）。这个自动清理在后端 `/api/async-tasks/my` 接口里实现：在查询时同步 UPDATE。
- 未来可加 cron 定期清理 `notified_at IS NOT NULL AND completed_at < NOW() - 30 days` 的物理行。
