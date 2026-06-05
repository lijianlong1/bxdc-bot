## 1. 自动 schema 迁移

- [x] 1.1 新建 `SchemaMigrationRunner.java` 实现 `InitializingBean`
- [x] 1.2 实现表/列/索引存在性检查（基于 information_schema）
- [x] 1.3 缺失则自动 ALTER（`notified_at` 列 + `idx_async_user_unread` 索引）
- [x] 1.4 加 `@Order(Ordered.HIGHEST_PRECEDENCE)` 早于调度器
- [x] 1.5 验证：先 DROP COLUMN，再启动服务 → 启动后列已自动加回

## 2. ThinkingMode 文案改造

- [x] 2.1 [ThinkingMode.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/ThinkingMode.vue) 标题"思考模式" → "调用过程"
- [x] 2.2 [ThinkingMode.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/ThinkingMode.vue) `currentStepText.思考中` → "准备调用..."
- [x] 2.3 [ThinkingMode.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/ThinkingMode.vue) `getNodeLabel` thinking/默认 → "调用准备"/"调用"
- [x] 2.4 [useThinkingMode.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/composables/useThinkingMode.ts) 初始节点 title/content 改名
- [x] 2.5 同步 dist 构建产物

## 3. 通知铃铛改文字

- [x] 3.1 [TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue) 移除 `<t-icon>` 改用"消息"文字
- [x] 3.2 删除 `.bell-button { font-size: 18px; }` 自定义字号
- [x] 3.3 [MessageList.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/MessageList.vue) banner `🔔` emoji 改"消息"文字标签 + 调整 CSS 样式

## 4. 通知列表功能增强

### 后端
- [x] 4.1 [AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java) 加 `deleteByIdAndUser` / `deleteByIdsAndUser`
- [x] 4.2 [AsyncTaskPollingService.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingService.java) 转发到 mapper
- [x] 4.3 [AsyncTaskNotificationController.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/AsyncTaskNotificationController.java) 加 `DELETE /api/async-tasks/{id}` 端点
- [x] 4.4 加 `POST /api/async-tasks/batch-delete` 端点（请求体 `{ "ids": [...] }`）

### 前端 Composable
- [x] 4.5 [useAsyncTaskNotifications.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/composables/useAsyncTaskNotifications.ts) 加 `deleteTask(taskId)` 方法
- [x] 4.6 加 `batchDelete(taskIds[])` 方法
- [x] 4.7 暴露新方法到 composable 返回值

### 前端组件
- [x] 4.8 [TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue) 加批量模式状态 (`batchMode` / `selectedIds`)
- [x] 4.9 加详情弹窗状态 (`detailVisible` / `detailTask`)
- [x] 4.10 顶部"批量管理"按钮 + 批量模式工具条（全选/批量删除/取消）
- [x] 4.11 每条非批量模式显示"查看"+"删除"按钮
- [x] 4.12 每条批量模式显示复选框
- [x] 4.13 加 `t-dialog` 详情弹窗（不跳转，展示全部字段）
- [x] 4.14 删除原"点击整行跳转"逻辑（改为点击内容区触发弹窗）
- [x] 4.15 加单条删除 + 批量删除的 confirm 提示
- [x] 4.16 加新 CSS：批量工具条、详情弹窗、列表项 actions 布局

## 5. 验证

- [x] 5.1 后端 `mvn compile` ✅
- [x] 5.2 前端 `npm run build` ✅
- [x] 5.3 skill-gateway 启动 ✅ (Started in 9.078s)
- [x] 5.4 `DELETE /api/async-tasks/99999` ✅ HTTP 200 `{"ok":false,"affected":0}`
- [x] 5.5 `POST /api/async-tasks/batch-delete` ✅ HTTP 200 `{"requested":3,"ok":true,"affected":0}`
- [x] 5.6 Vite HMR 自动热更新已生效
- [x] 5.7 三个服务（skill-gateway 18080 / agent-core 3000 / frontend 5173）全部运行中
