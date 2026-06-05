## 为什么

2026-06-03 上一波 `add-async-task-notification`（异步任务通知中心）已归档上线。
当天根据用户实际使用反馈，又做了 4 项小改动，进一步打磨通知中心和相关 UI 体验：

1. 数据库初始化不能再依赖手动 SQL — 部署到内网时 DBA 不会手工 ALTER。
2. "思考模式" 这个名字对用户来说很抽象 — 用户希望改为更直白的"调用过程"。
3. 顶栏铃铛在低版本浏览器渲染失败 — 改用纯文字"消息"按钮。
4. 通知列表只支持跳转，不支持"看一眼就完事" / 删除 / 批量清理。

## 变更内容

### 1. 自动 schema 迁移
- 新建 `SchemaMigrationRunner`（`InitializingBean`），启动时用 JDBC 查 `information_schema`
  检查 `async_tasks.notified_at` 列和 `idx_async_user_unread` 索引是否存在，
  缺失则自动 `ALTER TABLE` 添加。
- 实现位置：`backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java`
- 早于 `@EnableScheduling`，避免定时器在迁移前查询失败
- **完全幂等**，重启多少次都安全

### 2. ThinkingMode 文案改造
"思考模式" → "调用过程"，全链路改名：

| 原 | 新 |
|----|----|
| 思考模式 | 调用过程 |
| 思考中... | 准备调用... |
| 思考中（label） | 调用准备 |
| 思考（default label） | 调用 |
| 开始思考 | 开始调用 |
| 分析问题... | 准备调用流程... |

涉及文件：
- `frontend/src/components/ThinkingMode.vue` — 标题/步骤文案/节点 label
- `frontend/src/composables/useThinkingMode.ts` — 初始节点 title/content

### 3. 通知铃铛改文字
- 顶栏铃铛 `<t-icon name="notification" />` 在低版本浏览器 SVG 字体加载失败 → 改用纯文字"消息"
- 涉及文件：`frontend/src/components/TaskNotificationBell.vue`（按钮内容）
- 同时删除 `MessageList.vue` 中的 🔔 emoji banner 头，改为相同风格的"消息"文字标签

### 4. 通知列表增强：查看 + 单条/批量删除
原行为：点击整条任务 → 跳转到对应聊天页
新行为：保留"点击整行 → 弹窗查看详情（不跳转）"，新增"查看" + "删除" 按钮

| 功能 | 入口 | 行为 |
|------|------|------|
| 查看 | 每条"查看"按钮 / 非批量模式点击 | 弹窗显示完整任务详情（不动） |
| 单条删除 | 每条"删除"按钮 | confirm → DELETE /api/async-tasks/{id} |
| 批量管理 | 顶部"批量管理"按钮 | 进入批量模式，每行显示复选框 |
| 批量删除 | 顶部"批量删除"按钮 | confirm → POST /api/async-tasks/batch-delete |

后端新增端点：
- `DELETE /api/async-tasks/{id}` — 单条删除
- `POST /api/async-tasks/batch-delete` — 批量删除，请求体 `{ "ids": [...] }`

Mapper 新增 `deleteByIdAndUser` / `deleteByIdsAndUser`，WHERE 条件强制 `user_id = ?` 防越权。

## 能力

### 新增能力

- `auto-schema-migration`：skill-gateway 启动时自动补列/索引
- `task-notification-manage`：通知中心支持单条/批量删除、详情弹窗查看

### 修改的能力

- `task-notification-frontend`：铃铛图标改文字；列表项交互改为按钮驱动
- `thinking-mode-ui`：文案全链路改名"思考模式 → 调用过程"

## 影响

- **数据库**：自动迁移，无需人工介入；幂等
- **后端**：Mapper + Service + Controller 共 3 个文件新增方法；无破坏性变更
- **前端**：2 个文件大改 UI（TaskNotificationBell.vue, MessageList.vue）+ 2 个文件改名（ThinkingMode.vue, useThinkingMode.ts）
- **未引入第三方包**
- **无破坏性变更**：原"点击整行跳转"功能改为"点击整行弹窗"，但新弹窗中也可点击"跳转到原会话"的替代按钮（task-list 仍展示 sessionId 信息）
