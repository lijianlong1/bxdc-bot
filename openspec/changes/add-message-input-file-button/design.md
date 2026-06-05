## Context

文件上传 UI 集成。当前：
- `frontend/src/components/MessageInput.vue` 使用 `TChatSender` 组件，仅支持文本输入
- `frontend/src/composables/useFileUpload.ts` 已实现 `addFiles` / `removeFile` 等方法
- `frontend/src/types/fileUpload.ts` 提供 `FILE_INPUT_ACCEPT` 常量

## Goals / Non-Goals

**Goals:**
- 在输入框旁显示文件上传按钮
- 显示已选文件列表（按 FileType 分组）
- 支持移除单个文件
- 上传后自动触发解析
- 适配移动端

**Non-Goals:**
- 不修改 `useChat.sendMessage`（任务 8）
- 不实现 ChatView 的 provide（任务 7）— 任务 6 假设 useFileUpload 已由 ChatView 提供
- 不处理大文件分片（任务 4-5）

## Decisions

1. **使用原生 `<input type="file" multiple>` 而非 TDesign Upload 组件**：与 TChatSender 风格协调，避免引入额外组件。`accept` 属性使用 `FILE_INPUT_ACCEPT` 常量。

2. **文件列表显示在 TChatSender 上方**：当用户上传文件时，列表从顶部"展开"显示，与 TDesign 设计语言一致。

3. **按 FileType 分两组展示**：文档类（word/excel/ppt/txt）和图片类（image），使用不同的图标和布局。图片显示缩略图，文档显示文件名 + 类型 emoji + 大小。

4. **删除按钮使用小尺寸 `t-button variant="text"`**：与现有 TChatAction 按钮风格保持一致。

5. **移动端适配**：用 CSS `@media (max-width: 768px)` 调整文件列表的 padding 和字体大小。

6. **解析触发**：上传后立即调用 `parseFileContent`（任务 3 占位，状态流转到 'parsing'）。任务 4-5 完成后会自动真正解析。

## Risks / Trade-offs

- [Risk] 任务 3 中 `parseFileContent` 仍是占位 → 文档上传后状态停在 'parsing'，任务 4-5 完成后才能 'parsed'
- [Trade-off] 文件列表与 TChatSender 视觉整合度需测试 → 后续可能调整
