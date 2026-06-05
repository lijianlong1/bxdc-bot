## Why

文件上传功能的任务 7：在 ChatView 中整合 useFileUpload composable，注入文件上传状态到组件树中，并在合适的时机清空已上传文件，防止文件状态在对话/页面/路由之间残留。任务 3 已经实现 `provideFileUpload` / `clearFiles` 等方法，任务 6 已经在 MessageInput 中消费 `useFileUpload`，本任务专注于 ChatView 层的整合与生命周期管理。

## What Changes

- 修改 `frontend/src/views/ChatView.vue`
- 在 `<script setup>` 中调用 `provideFileUpload()` 注入文件上传状态，使 MessageInput 等子组件能通过 `useFileUpload()` 拿到同一份状态
- 「新建对话」（即 `clearChat()` 调用时）调用 `clearFiles()` 清空已上传文件及图片预览 URL
- 页面卸载时（`onUnmounted`）调用 `clearFiles()` 释放资源
- 路由切换离开聊天页时（`onBeforeRouteLeave`）调用 `clearFiles()` 释放资源
- 不修改 MessageInput.vue、useFileUpload.ts、useChat.ts 的接口

## Capabilities

### New Capabilities
- `chat-view-file-cleanup`: ChatView 文件状态整合与生命周期清理

### Modified Capabilities
- 无（不改变 `file-upload`、`file-upload-composable`、`message-input-file-button` 已有的 REQUIREMENTS）

## Impact

- 修改文件：`frontend/src/views/ChatView.vue`
- 依赖：
  - `frontend/src/composables/useFileUpload.ts`（任务 3，已存在，提供 `provideFileUpload` / `clearFiles`）
  - `frontend/src/composables/useChat.ts`（已存在，提供 `provideChat`）
  - `vue-router`（用于 `onBeforeRouteLeave`）
- 不影响已有消息发送逻辑（任务 8 处理）
- 不影响文件上传 UI（任务 6 已完成）
- 不新增 npm 依赖
