## Context

文件上传功能需要全局状态管理 composable。已有基础：
- `frontend/src/types/fileUpload.ts`（任务 1）— `FileType`、`UploadFileInfo`、`FILE_UPLOAD_CONFIG` 等
- `frontend/src/utils/fileValidator.ts`（任务 2）— `validateFile`、`validateFileSize` 等校验函数
- `frontend/src/composables/useChat.ts` — Vue Composition API + `provide/inject` 模式参考

## Goals / Non-Goals

**Goals:**
- 集中管理文件上传状态（按 FileType 分组）
- 提供 `addFiles` / `removeFile` / `clearFiles` 等核心方法
- 复用任务 2 校验工具，校验失败时通过 toast 反馈
- 状态通过 `provide/inject` 注入到 ChatView 层级
- `getAllParsedText` / `getFileNamesForMemory` 给 useChat 消费

**Non-Goals:**
- 不实现文件解析（任务 4-5：`parseFileContent` 仅做类型分发占位）
- 不集成 UI 组件（任务 6）
- 不修改 `useChat`（任务 8）

## Decisions

1. **使用 InjectionKey + provide/inject 模式**：与 `useChat` 的 `ChatKey` 保持一致。`useFileUpload` 函数在调用方未提供时返回本地状态（兜底），保证单文件上传组件可独立使用。

2. **状态分组用 `Record<FileType, UploadFileInfo[]>`**：`uploadedFiles` 按 FileType 分组，便于：
   - 调用 `validateTotalSize` / `validateFileCount` 时按组计算
   - `getAllParsedText` 顺序遍历
   - 未来 UI 按组展示（任务 6）

3. **`addFiles` 串行处理文件**：每个文件 await 校验后立即 push to 列表（带 toast 失败提示），不阻塞后续文件。`isUploading` 仅控制解析阶段（解析函数未实现时为 false）。

4. **`parseFileContent` 占位实现**：当前仅根据 `fileType` 抛 "未实现" 或返回 `msg.content`（纯文本直接用）。任务 4-5 会在 `fileParser.ts` / `imageOcr.ts` 中实现具体解析后，回填此方法的逻辑。

5. **清理机制完整**：`clearFiles` 同时清空状态、调用 `URL.revokeObjectURL` 释放图片预览 URL（避免内存泄漏）。

## Risks / Trade-offs

- [Risk] 占位 `parseFileContent` 暂时不能解析 Office 文档 → 文档上传后 `status: 'pending'`，`getAllParsedText` 跳过；任务 4 完成后回填
- [Risk] `addFiles` 中 toast 错误提示会中断部分上传 → 任务 6 UI 上会展示哪些成功哪些失败
- [Trade-off] `useFileUpload()` 无 provider 时降级为局部状态 → 单组件可用，但跨组件需 `provideFileUpload`
