## ADDED Requirements

### Requirement: 文件上传按钮

The system SHALL provide a file upload icon button in `MessageInput.vue`, next to the text input area.

#### Scenario: 默认显示上传按钮
- **WHEN** 用户进入聊天页
- **THEN** SHALL 显示一个文件上传图标按钮
- **AND** 点击按钮 SHALL 弹出系统文件选择器
- **AND** 文件选择器的 `accept` 属性 SHALL 等于 `FILE_INPUT_ACCEPT`（`.doc,.docx,.xls,.xlsx,...,.webp`）
- **AND** 文件选择器 SHALL 允许多选

#### Scenario: 选择文件后自动加入上传列表
- **WHEN** 用户在文件选择器中选择 1 个 .docx 文件
- **THEN** `useFileUpload.addFiles` SHALL 被调用
- **AND** 文件 SHALL 出现在输入框上方的已选文件列表中
- **AND** 上传按钮 SHALL 保持可点击状态（可继续选择更多文件）

#### Scenario: 不支持的文件被拒绝
- **WHEN** 用户选择 1 个 .mp4 文件
- **THEN** SHALL 通过 `MessagePlugin.error` 提示 "不支持的文件格式：.mp4"
- **AND** 该文件 SHALL NOT 被加入上传列表

### Requirement: 已选文件列表展示

The system SHALL display the uploaded files in a list above the text input area, grouped by category (documents / images).

#### Scenario: 文档文件展示
- **WHEN** 已上传 1 个 .docx 文件（"report.docx"，1.5 MiB）
- **THEN** 列表中 SHALL 显示：
  - 文件类型 emoji（📄）
  - 文件名 "report.docx"
  - 文件大小 "1.50 MiB"
  - 删除按钮

#### Scenario: 图片文件展示缩略图
- **WHEN** 已上传 1 个 .png 图片
- **THEN** 列表中 SHALL 显示：
  - 图片缩略图（previewUrl）
  - 文件名
  - 删除按钮

#### Scenario: 列表按类型分组
- **WHEN** 用户上传 1 个 .docx 和 1 个 .png
- **THEN** 文档和图片 SHALL 分别显示在不同分组下
- **AND** 文档分组使用 📄/📊/📽️/📝 标识
- **AND** 图片分组使用 🖼️ 标识

### Requirement: 移除单个文件

The system SHALL provide a delete button for each uploaded file. Clicking SHALL remove the file from the list.

#### Scenario: 点击删除按钮移除文件
- **WHEN** 用户点击已上传文件旁的删除按钮
- **THEN** `useFileUpload.removeFile` SHALL 被调用（传入该文件 id）
- **AND** 该文件 SHALL 从列表中消失
- **AND** 该文件的 `previewUrl` SHALL 通过 `URL.revokeObjectURL` 释放

#### Scenario: 列表为空时隐藏
- **WHEN** `useFileUpload.uploadedFiles` 所有分组均为空
- **THEN** 整个文件列表区域 SHALL NOT 渲染（不显示空容器）

### Requirement: 上传后自动触发解析

The system SHALL call `useFileUpload.parseFileContent` for each newly uploaded file after `addFiles` completes.

#### Scenario: 解析中显示 loading
- **WHEN** 用户上传 1 个 .docx 文件
- **THEN** 文件条目 SHALL 显示 loading 状态（如旋转图标或 "解析中..." 文字）
- **AND** 状态 SHALL 为 `'parsing'`

#### Scenario: 解析失败显示错误
- **WHEN** 解析抛出异常
- **THEN** 文件条目 SHALL 显示错误信息
- **AND** 状态 SHALL 为 `'failed'`
- **AND** 错误信息 SHALL 来自 `errorMessage` 字段

### Requirement: 移动端响应式

The system SHALL adapt the file list layout for mobile devices.

#### Scenario: 窄屏适配
- **WHEN** 视口宽度 ≤ 768px
- **THEN** 文件列表 SHALL 使用更紧凑的 padding
- **AND** 缩略图 SHALL 缩小到 ≤ 48px
- **AND** 文件名 SHALL 支持截断省略（CSS `text-overflow: ellipsis`）
