## Why

文件上传功能的任务 6：在聊天输入框区域增加文件上传触发按钮和已选文件列表展示。任务 3 已完成 useFileUpload composable（含 addFiles/removeFile 等方法），任务 1 提供了 FileType 和 FILE_INPUT_ACCEPT 等常量。本任务专注于 UI 集成。

## What Changes

- 修改 `frontend/src/components/MessageInput.vue`
- 在 TChatSender 左侧/上方增加文件上传图标按钮（使用原生 `<input type="file">`）
- 配置 `accept` 属性限制可选文件类型
- 支持多文件选择（`multiple`）
- 在输入框区域上方显示已选文件列表（文件名 + 类型图标 + 大小 + 删除按钮）
- 文件列表按类型分组展示（文档 / 图片）
- 文件上传后自动触发解析，解析中显示 loading 状态
- 校验失败时通过 MessagePlugin.error 弹出错误提示
- 适配移动端响应式布局

## Capabilities

### New Capabilities
- `message-input-file-button`: MessageInput 文件上传 UI 集成

### Modified Capabilities
- 无（仅消费已存在的 file-upload spec 和 file-upload-composable）

## Impact

- 修改文件：`frontend/src/components/MessageInput.vue`
- 依赖：
  - `frontend/src/composables/useFileUpload.ts`（任务 3，已存在）
  - `frontend/src/types/fileUpload.ts`（任务 1，已存在）
  - `frontend/src/components/UserAvatar.vue`（项目已有，可参考 icon 使用）
- 引入图标：`UploadIcon` from `tdesign-icons-vue-next`
- 不影响已有消息发送逻辑（仅在 send 时附加文件上下文，任务 8 处理）
