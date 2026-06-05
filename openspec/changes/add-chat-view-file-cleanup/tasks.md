## 1. App 层级 provide 注入

- [x] 1.1 在 `App.vue` 的 `<script setup>` 中 import `provideFileUpload` from `./composables/useFileUpload`
- [x] 1.2 在 setup 阶段调用 `const fileUpload = provideFileUpload()` 注入状态
- [x] 1.3 验证 `useFileUpload` 内部已存在 `clearFiles` 方法（任务 3 已实现）

## 2. 窗口关闭 / 刷新清理

- [x] 2.1 在 App.vue 中 import `onMounted`, `onBeforeUnmount` from `vue`
- [x] 2.2 定义 `function clearOnWindowUnload(): void { fileUpload.clearFiles() }`
- [x] 2.3 在 `onMounted` 中注册 `window.addEventListener('beforeunload', clearOnWindowUnload)`
- [x] 2.4 在 `onBeforeUnmount` 中注销监听器

## 3. ChatView 还原

- [x] 3.1 移除 `ChatView.vue` 中所有文件相关代码（provideFileUpload、clearChat、defineExpose、onUnmounted、onBeforeRouteLeave）
- [x] 3.2 ChatView 不再负责文件状态，仅在 App.vue 注入

## 4. 验证

- [x] 4.1 运行 `npx vue-tsc --noEmit` 确认编译通过
- [x] 4.2 浏览器进入 /chat 路由，确认控制台无报错，MessageInput 上传按钮可点击
- [x] 4.3 在 /chat 上传一个 .docx 文件，确认出现在文件列表
- [x] 4.4 跳转到 /skill-hub，再返回 /chat，确认文件仍在列表（不清理）
- [x] 4.5 关闭浏览器窗口，重新打开 /chat，确认无残留文件（清理生效）
- [x] 4.6 刷新 /chat 页面，确认无残留文件（清理生效）
