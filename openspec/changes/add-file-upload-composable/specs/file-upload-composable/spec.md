## ADDED Requirements

### Requirement: 文件上传状态结构

The system SHALL provide a `FileUploadState` interface containing `uploadedFiles` (Record<FileType, UploadFileInfo[]>), `isUploading` (boolean), and `uploadError` (string | null).

#### Scenario: 初始状态为空
- **WHEN** `provideFileUpload()` 被首次调用
- **THEN** `uploadedFiles` SHALL 是 5 个空数组的 `Record<FileType, UploadFileInfo[]>`（word/excel/ppt/txt/image 全部为 `[]`）
- **AND** `isUploading` SHALL 为 `false`
- **AND** `uploadError` SHALL 为 `null`

### Requirement: addFiles 添加文件

The system SHALL provide `addFiles(files: File[]): Promise<void>` method that adds validated files to `uploadedFiles` grouped by `FileType`.

#### Scenario: 通过校验的文件被加入列表
- **WHEN** 用户选择 2 个 .docx 文件，调用 `addFiles([file1, file2])`
- **THEN** `uploadedFiles.word` SHALL 包含这 2 个 `UploadFileInfo` 对象
- **AND** 每个对象的 `status` SHALL 为 `'pending'`
- **AND** `fileType` SHALL 为 `'word'`
- **AND** `id` SHALL 是唯一的字符串

#### Scenario: 校验失败的文件被拒绝
- **WHEN** 用户选择 1 个 .docx 和 1 个 .mp4，调用 `addFiles([docx, mp4])`
- **THEN** `uploadedFiles.word` SHALL 仅包含 docx
- **AND** SHALL 通过 `MessagePlugin.error` 提示 `.mp4` 不支持
- **AND** mp4 不应被加入任何 `uploadedFiles` 组

#### Scenario: 超过单类型数量上限
- **WHEN** word 类型已上传 3 个文件（限额 3），继续添加 1 个
- **THEN** `addFiles` SHALL 拒绝新文件
- **AND** SHALL 提示 "Word 文档数量超过上限（上限 3 个）"
- **AND** 已有 3 个文件 SHALL 保持不变

#### Scenario: 超过单类型总大小上限
- **WHEN** image 类型已上传 28 MiB，添加 5 MiB 图片（限额 30 MiB）
- **THEN** `addFiles` SHALL 拒绝新文件
- **AND** SHALL 提示 "图片总大小超过上限"
- **AND** 已有文件 SHALL 保持不变

### Requirement: removeFile 移除文件

The system SHALL provide `removeFile(fileId: string): void` method that removes a single file from `uploadedFiles`.

#### Scenario: 通过 id 移除文件
- **WHEN** 调用 `removeFile('uuid-123')` 且该 id 存在于 `uploadedFiles.word`
- **THEN** `uploadedFiles.word` SHALL 不再包含该 id 对应的文件
- **AND** 其他文件 SHALL 保持不变

#### Scenario: 不存在的 id 不报错
- **WHEN** 调用 `removeFile('non-existent')`
- **THEN** SHALL 静默返回，不抛错

### Requirement: clearFiles 清空所有

The system SHALL provide `clearFiles(): void` method that removes all files from `uploadedFiles` and revokes any image preview URLs.

#### Scenario: 清空所有文件
- **WHEN** 调用 `clearFiles()` 且 `uploadedFiles` 包含文件
- **THEN** 5 个 `FileType` 分组 SHALL 全部变回 `[]`
- **AND** 所有 image 的 `previewUrl` SHALL 通过 `URL.revokeObjectURL` 释放

#### Scenario: 空状态下 clearFiles 幂等
- **WHEN** 调用 `clearFiles()` 且 `uploadedFiles` 已为空
- **THEN** SHALL 静默返回，不抛错

### Requirement: getAllParsedText 汇总解析文字

The system SHALL provide `getAllParsedText(): string` method that concatenates all `parsedText` from files with `status === 'parsed'`.

#### Scenario: 多个已解析文件汇总
- **WHEN** 有 2 个 word 文件已解析，`parsedText` 分别为 "A 内容" 和 "B 内容"
- **THEN** `getAllParsedText()` SHALL 返回包含两段文字的字符串
- **AND** SHALL 用明显的分隔符（如 `\n\n--- 文件：xxx ---\n`）区隔

#### Scenario: 跳过未解析或失败的文件
- **WHEN** 部分文件 `status` 为 `'pending'` 或 `'failed'`
- **THEN** `getAllParsedText()` SHALL 仅汇总 `status === 'parsed'` 的文件

#### Scenario: 无文件时返回空字符串
- **WHEN** `uploadedFiles` 为空
- **THEN** `getAllParsedText()` SHALL 返回 `''`

### Requirement: getFileNamesForMemory 获取文件名清单

The system SHALL provide `getFileNamesForMemory(): string[]` method that returns an array of all uploaded file names.

#### Scenario: 返回所有文件名
- **WHEN** `uploadedFiles` 包含 3 个文件（1 个 word、2 个 image）
- **THEN** `getFileNamesForMemory()` SHALL 返回 `['a.docx', 'b.png', 'c.jpg']`

#### Scenario: 空列表返回空数组
- **WHEN** `uploadedFiles` 为空
- **THEN** SHALL 返回 `[]`

### Requirement: parseFileContent 解析文件内容

The system SHALL provide `parseFileContent(file: UploadFileInfo): Promise<string>` method that parses a single file and updates its `status` and `parsedText`.

#### Scenario: 解析成功
- **WHEN** 调用 `parseFileContent(info)` 且 `info.status === 'pending'`
- **THEN** `info.status` SHALL 变为 `'parsing'` → `'parsed'`
- **AND** `info.parsedText` SHALL 包含解析出的文字

#### Scenario: 解析失败
- **WHEN** 解析器抛出异常
- **THEN** `info.status` SHALL 变为 `'failed'`
- **AND** `info.errorMessage` SHALL 包含错误描述

#### Scenario: 重复解析被跳过
- **WHEN** 文件 `status === 'parsed'` 已解析，再次调用 `parseFileContent`
- **THEN** SHALL 直接返回当前 `parsedText`，不重复解析

### Requirement: provideFileUpload / useFileUpload 注入模式

The system SHALL provide `provideFileUpload()` and `useFileUpload()` functions following the same pattern as `provideChat` / `useChat`.

#### Scenario: 注入和消费状态
- **WHEN** 在 ChatView 中调用 `provideFileUpload()`，在子组件中调用 `useFileUpload()`
- **THEN** 子组件 SHALL 拿到与父组件相同的 `FileUploadState` 引用
- **AND** 子组件的修改 SHALL 影响父组件状态（同一引用）

#### Scenario: 无 provider 时降级
- **WHEN** 在没有 `provideFileUpload()` 的组件中调用 `useFileUpload()`
- **THEN** SHALL 返回一个本地初始化的 `FileUploadState`（单组件独立使用）
- **AND** SHALL NOT 抛错

#### Scenario: provideFileUpload 在 ChatView 卸载时不自动 clear
- **WHEN** 组件卸载
- **THEN** `uploadedFiles` 仍 SHALL 保留在内存中（任务 7 由 ChatView 显式调用 `clearFiles`）
