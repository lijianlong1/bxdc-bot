## Why

文件上传功能的任务 8：将已上传的文件内容整合到消息发送流程中。任务 3 已实现 `useFileUpload`（含 `getAllParsedText` / `getFileNamesForMemory` / `clearFiles`），任务 6 已在 MessageInput 中接入上传 UI，任务 7 已在 App 层级 provide。本任务专注于 sendMessage 的内容组装、记忆上报、状态清理。

## What Changes

- 修改 `frontend/src/composables/useChat.ts`
  - `sendMessage` 方法签名增加第三个可选参数 `attachedFiles?: UploadFileInfo[]`
  - 在发送给 `/agent/run` 的 `instruction` 字段中拼接文件解析内容
  - 在流式响应完成后调用 `/memory/add` 上报文件名清单（不传内容）
  - sendMessage 完成后调用 `useFileUpload.clearFiles()` 清空文件状态
- 修改 `frontend/src/components/MessageInput.vue`
  - `handleSend` 调用 `sendMessage` 时传入 `allFiles.value`（useFileUpload 中的扁平化文件列表）
- 不修改 useFileUpload / App.vue / ChatView 的接口
- 不修改 sendMessage 的 SSE 流处理逻辑

## Capabilities

### New Capabilities
- `usechat-message-file-integration`: useChat 消息发送时整合文件内容与清理状态

### Modified Capabilities
- 无（不改变已有 `file-upload` / `file-upload-composable` / `message-input-file-button` / `chat-view-file-cleanup` 的 REQUIREMENTS）

## Impact

- 修改文件：
  - `frontend/src/composables/useChat.ts`
  - `frontend/src/components/MessageInput.vue`
- 依赖：
  - `frontend/src/composables/useFileUpload.ts`（任务 3，已存在）
  - `frontend/src/types/fileUpload.ts`（任务 1，已存在）
  - `backend/agent-core/src/controller/memory.controller.ts`（已存在，提供 `/memory/add` 端点）
- 不影响已有纯文本消息发送（attachedFiles 为可选参数，不传时与原行为一致）
- 不影响 SSE 流处理逻辑
- 不新增 npm 依赖
