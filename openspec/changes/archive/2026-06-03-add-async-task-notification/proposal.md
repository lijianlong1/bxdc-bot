## 为什么

当前异步 Skill 任务（API Skill 轮询）只能在用户停留的对话页面中跟踪。一旦用户刷新页面、切换到其他会话或暂时离开，就无法：
- 知道后台还有几个任务正在执行
- 重新进入会话后查看这些任务的状态
- 知道任务何时完成以及执行结果

`async_tasks` 表里有 `PENDING / POLLING / COMPLETED / FAILED` 等状态记录，但前端没有任何通知机制。
用户离开页面期间任务完成了也只能在数据库中查询，UX 断裂。

本变更在导航栏添加一个"任务通知"小徽标，点击进入抽屉式列表，可看到当前用户所有进行中、已完成未读、失败未读的异步任务；用户点击查看后标记已读，徽标计数相应减少。

### 范围说明：什么样的任务算"异步任务"？

**只有**满足下列全部条件的 Skill 调用才进入通知系统：

1. Skill 显式配置了 `asyncPoll`（轮询端点 + 间隔 + 状态判定），由 `executeConfiguredApiSkill` 走 `/api/skills/api` 的异步分支创建 `async_tasks` 记录。
2. 任务执行耗时预期在分钟～小时级别（数秒内能返回的同步 HTTP 调用不会记录）。

页面上能秒回（chat message 秒回）的普通对话 / 普通 Skill 调用、SSH/Linux 脚本等同步执行的操作，**不**进入通知系统，不计入徽标。

这样可以保证徽标和通知列表**只反映"用户需要离开当前页面等待"的长任务**，避免噪声。

## 变更内容

- **任务通知徽标**：在 Layout.vue 头部最右侧、用户头像左侧添加一个铃铛图标 + 数字徽标。
- **未读计数实时更新**：通过定时轮询 `/api/async-tasks/my?statusFilter=unread` 获取当前用户的未读任务数。
- **通知抽屉**：点击铃铛后弹出抽屉式抽屉，列出所有任务（按时间倒序），含：
  - 任务状态：PENDING / POLLING / COMPLETED / FAILED
  - 外部任务 ID + 关联 skill 名
  - 创建时间 / 已耗时 / 完成时间
  - 进度条（POLLING 状态时根据 `poll_responses` 数量估算）
  - 完成后显示结果摘要（截断）
  - 失败时显示 `error_message`
- **点击任务行为**：点击某条通知 → 跳转到对应 sessionId 的聊天页面，并把任务详情插到对应消息流中。
- **自动 / 手动标已读**：用户点击查看后该条任务标记为已读（`notified_at = NOW()`）。已读的不再计入徽标。
- **后端支持**：扩展 `async_tasks` 表 + mapper/service + 新增 Controller 端点：
  - `GET /api/async-tasks/my?unreadOnly=true` — 列出当前用户未读任务
  - `GET /api/async-tasks/my?limit=20` — 列出最近 N 个任务
  - `POST /api/async-tasks/{id}/ack` — 标记已读
  - `GET /api/async-tasks/my/unread-count` — 仅返回未读数量（用于徽标轮询）

## 能力

### 新增能力

- `task-notification-frontend`：Layout 顶栏铃铛徽标 + 抽屉式通知列表组件。
- `async-task-user-api`：skill-gateway 提供"按用户查询异步任务"和"标记已读"API。
- `async-task-read-tracking`：`async_tasks` 表新增 `notified_at` 字段追踪已读状态；用户级联过滤。

### 修改的能力

- `async-tasks-schema`：`async_tasks` 表新增 `notified_at DATETIME` 列。
- `task-controller`：TaskController SSE 事件可在 `status=COMPLETED/FAILED` 时打上 `notified_at = NULL`（未读）。
- `chat-page-routing`：用户点击通知项跳转到 `/chat/:sessionId?taskId=xxx` 路径，前端自动滚动到对应消息并显示任务卡片。

## 影响

- **数据库**：新增 `notified_at` 列；不可丢失历史数据；无破坏性变更。
- **后端 API**：新增 3 个 HTTP 端点（GET/POST）。
- **前端依赖**：复用现有 tdesign-vue-next 组件（`t-badge`、`t-drawer`、`t-list`），不引入新包。
- **性能**：徽标轮询默认 30s 一次，可配置；未读列表按需加载，不会高频请求。
- **权限**：所有端点基于 `userId` 过滤，无跨用户泄露。
