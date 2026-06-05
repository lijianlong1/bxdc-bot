## Why

文件上传功能需要全局状态管理 composable，向上承接 `MessageInput.vue` 选择的文件，向下协调文件解析、清理、与 `useChat` 的集成。任务 2 已完成文件校验工具，需要一个统一的状态入口来调用校验、组织文件列表、提供 provide/inject 能力。

## What Changes

- 新增 `frontend/src/composables/useFileUpload.ts`
- 声明响应式状态：`uploadedFiles`（按 `FileType` 分组）、`isUploading`、`uploadError`
- 实现 `addFiles(files: File[])` 方法：遍历文件 → 校验 → 确认格式 → 加入列表
- 实现 `removeFile(fileId: string)` 方法：从列表中移除单个文件
- 实现 `clearFiles()` 方法：清空所有已上传文件
- 实现 `getAllParsedText()` 方法：汇总所有已解析文件的文字内容
- 实现 `getFileNamesForMemory()` 方法：获取所有文件名清单（用于 /memory/add）
- 实现 `parseFileContent(file: UploadFileInfo)` 方法：根据类型调用对应的解析器
- 提供 `provideFileUpload()` / `useFileUpload()` 模式（与 `useChat` 一致）

## Capabilities

### New Capabilities
- `file-upload-composable`: 文件上传状态管理 composable

### Modified Capabilities
- 无（仅依赖已存在的 file-upload spec 中的类型定义）

## Impact

- 新增文件：`frontend/src/composables/useFileUpload.ts`
- 依赖：
  - `frontend/src/types/fileUpload.ts`（已存在）
  - `frontend/src/utils/fileValidator.ts`（任务 2，已存在）
- 后续任务（任务 4-8）将消费本 composable 暴露的状态和方法
