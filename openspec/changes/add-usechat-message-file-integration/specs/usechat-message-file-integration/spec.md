## ADDED Requirements

### Requirement: sendMessage 支持文件参数

`useChat.sendMessage` SHALL 接受第三个可选参数 `attachedFiles?: UploadFileInfo[]`，向后兼容现有 `sendMessage(content, userId?)` 调用。

#### Scenario: 不传文件时行为不变
- **WHEN** 调用方调用 `sendMessage(text, userId)` 不传第三个参数
- **THEN** SHALL 走与之前完全一致的纯文本发送逻辑
- **AND** `instruction` SHALL 仅包含用户文本
- **AND** SHALL NOT 调用 `/memory/add` 上报文件
- **AND** SHALL NOT 调用 `clearFiles()`

#### Scenario: 传入空数组时行为不变
- **WHEN** 调用方传入 `attachedFiles = []`
- **THEN** SHALL 走与不传参数时一致的逻辑
- **AND** SHALL NOT 拼接任何文件内容
- **AND** SHALL NOT 调用 `/memory/add`
- **AND** SHALL NOT 调用 `clearFiles()`

### Requirement: 文件解析内容拼接到 instruction

sendMessage SHALL 在发送给 `/agent/run` 的 `instruction` 字段中拼接所有 `attachedFiles` 的 `parsedText`。

#### Scenario: 单个文件拼接
- **WHEN** 调用 `sendMessage('请总结', 'user-1', [{ fileName: 'a.docx', parsedText: '内容 A', ... }])`
- **THEN** `instruction` SHALL 形如：
  ```
  请总结

  --- 文件：a.docx ---
  内容 A
  ```

#### Scenario: 多个文件拼接
- **WHEN** 调用 `sendMessage('hi', 'u', [{ fileName: 'a.docx', parsedText: '内容A' }, { fileName: 'b.xlsx', parsedText: '内容B' }])`
- **THEN** `instruction` SHALL 形如：
  ```
  hi

  --- 文件：a.docx ---
  内容A
  --- 文件：b.xlsx ---
  内容B
  ```

#### Scenario: 跳过空 parsedText 的文件
- **WHEN** `attachedFiles` 中某项 `parsedText` 为空字符串或 undefined
- **THEN** SHALL NOT 在 instruction 中包含该文件的 `--- 文件：xxx ---` 段落
- **AND** 该文件 SHALL 仍参与 `/memory/add` 上报（只跳 instruction 拼接，不跳文件名上报）

#### Scenario: 整个 attachedFiles 解析都为空
- **WHEN** 所有 `attachedFiles` 的 `parsedText` 都为空
- **THEN** `instruction` SHALL 仅包含用户文本
- **AND** 仍 SHALL 调用 `/memory/add` 上报文件名
- **AND** 仍 SHALL 调用 `clearFiles()`

### Requirement: /memory/add 上报文件名清单

sendMessage 在 SSE 流正常完成后 SHALL 调用 `POST /memory/add` 上报本次对话涉及的文件名（仅传文件名，不传文件内容）。

#### Scenario: 流完成后上报
- **WHEN** `/agent/run` SSE 流正常结束（`done` 事件到达）
- **AND** `attachedFiles.length > 0`
- **AND** `userId` 已提供
- **THEN** SHALL 调用 `POST /memory/add` body：
  ```json
  {
    "userId": "<userId>",
    "text": "本次对话涉及文件：file1.docx、file2.xlsx",
    "role": "system"
  }
  ```

#### Scenario: 多文件名拼接
- **WHEN** `attachedFiles = [a, b, c]`
- **THEN** `text` SHALL 为 `本次对话涉及文件：a、b、c`（用中文顿号分隔）
- **AND** SHALL NOT 包含文件内容或解析文本

#### Scenario: 缺失 userId 时不上报
- **WHEN** `userId` 为 undefined / null / 空字符串
- **THEN** SHALL NOT 调用 `/memory/add`

#### Scenario: 上报失败不阻塞主流程
- **WHEN** `/memory/add` 请求失败（HTTP 非 2xx 或网络异常）
- **THEN** SHALL `console.error` 记录错误
- **AND** SHALL NOT 抛错中断主流程
- **AND** `clearFiles()` 仍 SHALL 被调用

#### Scenario: 流异常时不上报
- **WHEN** SSE 流在 `done` 之前异常中断
- **THEN** SHALL NOT 调用 `/memory/add`
- **AND** `clearFiles()` 仍 SHALL 被调用

### Requirement: sendMessage 完成后清空文件

sendMessage SHALL 在 finally 块调用 `useFileUpload.clearFiles()` 清空所有已上传文件，释放 `previewUrl` 并重置状态。

#### Scenario: 正常完成时清空
- **WHEN** SSE 流正常完成
- **AND** `attachedFiles.length > 0`
- **THEN** `clearFiles()` SHALL 被调用
- **AND** `useFileUpload.uploadedFiles` SHALL 被重置为 5 个空数组
- **AND** 所有图片 `previewUrl` SHALL 通过 `URL.revokeObjectURL` 释放

#### Scenario: 流异常时清空
- **WHEN** SSE 流异常中断或 fetch 失败
- **AND** `attachedFiles.length > 0`
- **THEN** `clearFiles()` 仍 SHALL 被调用（finally 兜底）

#### Scenario: 未传文件时不调用
- **WHEN** `attachedFiles` 缺省或为空数组
- **THEN** `clearFiles()` SHALL NOT 被调用
- **AND** 现有 useFileUpload 状态保持不变

### Requirement: MessageInput 传递文件

MessageInput SHALL 在 `handleSend` 调用 `sendMessage` 时传入 `allFiles.value`（useFileUpload 中的扁平化文件列表）。

#### Scenario: 有文件时传入
- **WHEN** 用户点击发送且 `allFiles.value.length > 0`
- **THEN** SHALL 调用 `sendMessage(text, currentUser.value?.id, allFiles.value)`

#### Scenario: 无文件时不传
- **WHEN** `allFiles.value.length === 0`
- **THEN** SHALL 沿用原签名 `sendMessage(text, currentUser.value?.id)`
- **AND** 行为 SHALL 与原纯文本发送完全一致
