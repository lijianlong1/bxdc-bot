# pass-parsed-content-to-llm

## Purpose

确保前端在 sendMessage 时：
- 已解析的文件（`status === 'parsed'`）的 `parsedText` 正确拼到 `/agent/run` 的 `instruction`，让大模型能基于文件内容回答
- 解析中的文件（`status === 'parsing'`）通过用户交互决定等待或跳过
- 解析失败的文件（`status === 'failed'`）不参与本次对话，UI 明确提示
- 大文件解析结果按阈值截断，避免 instruction 过大触发 LLM token 上限

## Requirements

### Requirement: 已解析文件必传

`useChat.sendMessage` 必须在发起 `/agent/run` 请求前，将 `attachedFiles` 中所有 `status === 'parsed'` 且 `parsedText` 非空的文件的文本拼接到 `instruction` 字段。

#### Scenario: 用户上传单个 .docx 完成后立即发送

- **WHEN** user 上传 .docx 文件，等待 `status === 'parsed'` 后输入文本点「发送」
- **THEN** `/agent/run` 请求的 `instruction` 字段包含 `[用户消息]\n\n--- 文件：filename ---\n<parsedText>`

#### Scenario: 用户上传多个文件部分解析未完成

- **WHEN** user 上传 2 个 .docx，1 个已 parsed，1 个仍 parsing
- **THEN** sendMessage 只把已 parsed 的 1 个文件拼到 instruction；parsing 中的文件按「等待 / 立即发送」交互处理

#### Scenario: 解析失败的文件不参与

- **WHEN** user 上传 .pdf（任务 4 范围不支持）解析失败
- **THEN** sendMessage 排除该文件，UI 列表中显示「该文件未能解析，不参与本次对话」

### Requirement: 解析中文件用户决策

当 `attachedFiles` 中存在 `status === 'parsing'` 的文件时，MessageInput 必须弹出用户决策提示，让用户在「等待解析完成 / 立即发送（跳过） / 取消」中选择。

#### Scenario: 用户选择「等待解析完成」

- **WHEN** t-popconfirm 用户选「等待」
- **THEN** handleSend 调用 `await useFileUpload.waitForAllParsing({ timeoutMs: 5000 })`
- **AND** 超时前若所有文件均完成（`status === 'parsed'` 或 `failed`），正常 sendMessage
- **AND** 超时后仍有 `parsing` 文件，把这些文件标记为 `status === 'skipped'`，弹 toast「N 个文件解析超时，已跳过」

#### Scenario: 用户选择「立即发送」

- **WHEN** t-popconfirm 用户选「立即发送」
- **THEN** 把所有 `status === 'parsing'` 的文件标记为 `status === 'skipped'`
- **AND** 立即调用 sendMessage（不参与 instruction）

#### Scenario: 用户选择「取消」

- **WHEN** t-popconfirm 用户选「取消」
- **THEN** 不调用 sendMessage，输入框内容保留

### Requirement: 解析文本长度截断

`useFileUpload.getAllParsedText` 必须对每个文件 `parsedText` 应用 80KB 单文件上限，并对所有文件总大小应用 200KB 上限。截断处必须追加明确的 `[内容已截断]` 标记。

#### Scenario: 单文件超过 80KB

- **WHEN** .docx 解析结果 250KB
- **THEN** `getAllParsedText` 输出截断到 80KB，追加 `... [内容已截断，原 250 KB]`
- **AND** MessageInput 在该文件行显示「解析内容已截断」徽标

#### Scenario: 多文件总大小超过 200KB

- **WHEN** 3 个文件分别 80KB 解析结果
- **THEN** 累加到第 3 个文件时总大小超 200KB，截断第 3 个文件
- **AND** 追加 `... [因总大小限制已截断]`

### Requirement: 新增 `skipped` 状态

`UploadFileInfo.status` 类型必须扩展为 `'pending' | 'parsing' | 'parsed' | 'failed' | 'skipped'`，新增 `skipped` 表示「用户主动跳过 / 解析超时未完成」。

#### Scenario: skipped 文件视觉表现

- **WHEN** 文件 `status === 'skipped'`
- **THEN** MessageInput 文件列表中显示浅灰色 + 划线 + 「已跳过」文字
- **AND** sendMessage 不参与 instruction 拼接

### Requirement: 兼容性

当 `attachedFiles` 参数缺省或为空数组时，sendMessage 行为必须与任务 8 完成后完全一致（纯文本对话）。

#### Scenario: 未传文件发送

- **WHEN** user 输入文本不传文件点「发送」
- **THEN** `instruction` 仅包含用户文本，无文件段落
- **AND** 不调用 `/memory/add`
- **AND** finally 块不调用 `clearFiles`

### Requirement: waitForAllParsing 接口

`useFileUpload` 必须新增 `waitForAllParsing(opts?: { timeoutMs?: number })` 方法，返回 `Promise<{ done: UploadFileInfo[]; pending: UploadFileInfo[]; failed: UploadFileInfo[] }>`。

#### Scenario: 默认 5s 超时

- **WHEN** `waitForAllParsing()` 不传参
- **THEN** 默认 `timeoutMs = 5000`
- **AND** 超时返回当前 `done` / `pending` / `failed` 三分类

#### Scenario: 自定义超时

- **WHEN** `waitForAllParsing({ timeoutMs: 10000 })`
- **THEN** 最多等待 10 秒
