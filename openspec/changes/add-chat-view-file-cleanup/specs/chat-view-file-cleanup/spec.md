## ADDED Requirements

### Requirement: App 层级注入文件上传状态

App.vue SHALL 在 `<script setup>` 中调用 `provideFileUpload()`，使 MessageInput 等子组件能通过 `useFileUpload()` 拿到共享的文件上传状态。

#### Scenario: 跨路由切换状态保持
- **WHEN** 用户从 /chat 跳转到 /skill-hub
- **THEN** App.vue SHALL NOT 卸载
- **AND** 已注入的文件上传状态 SHALL 保留
- **AND** 用户从 /skill-hub 返回 /chat 后 MessageInput SHALL 仍能读取到之前的文件列表

#### Scenario: 不影响 provideChat
- **WHEN** ChatView 内部仍调用 `provideChat()`
- **THEN** ChatView 注入的 `ChatKey` SHALL 与 App.vue 注入的 `FileUploadKey` 共存
- **AND** 两者 SHALL NOT 互相干扰

### Requirement: 关闭浏览器窗口时清空文件

App.vue SHALL 在 `window.beforeunload` 事件触发时调用 `clearFiles()`，释放文件状态和图片 `previewUrl`，防止敏感文件残留。

#### Scenario: 关闭窗口触发清理
- **WHEN** 用户关闭浏览器 tab 或窗口
- **THEN** `beforeunload` 监听器 SHALL 调用 `useFileUpload.clearFiles()`
- **AND** 所有 FileType 分组（word/excel/ppt/txt/image）SHALL 被重置为空数组
- **AND** 所有图片 `previewUrl` SHALL 通过 `URL.revokeObjectURL` 释放
- **AND** `uploadError` SHALL 被置为 `null`

#### Scenario: 刷新页面也触发清理
- **WHEN** 用户刷新 /chat 页面（F5）
- **THEN** `beforeunload` 监听器 SHALL 同样触发
- **AND** 文件状态 SHALL 被清空（防止刷新后旧文件残留）

### Requirement: 路由切换时保留文件

App.vue SHALL NOT 在路由切换时清空文件。用户离开聊天页（如跳到 /skill-hub）后再返回，已上传的文件 SHALL 仍在列表中。

#### Scenario: 离开 /chat 路由不清理
- **WHEN** 用户从 /chat 跳转到 /skill-hub
- **THEN** 文件上传状态 SHALL NOT 被清空
- **AND** App.vue SHALL NOT 卸载
- **AND** provide 注入的引用 SHALL 保持

#### Scenario: 返回 /chat 仍能看到文件
- **WHEN** 用户从 /skill-hub 返回 /chat
- **THEN** MessageInput 上方的文件列表 SHALL 仍显示之前上传的文件
- **AND** `useFileUpload()` 注入 SHALL 仍指向 App.vue 的共享 state
- **AND** 图片 `previewUrl` SHALL 仍有效
