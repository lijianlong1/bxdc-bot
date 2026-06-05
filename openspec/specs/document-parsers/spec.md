# Spec: document-parsers（任务 4：文档内容解析器）

## ADDED Requirements

### Requirement: DOCX 纯文本提取

The system SHALL provide a `parseDocx(file: File): Promise<string>` function that extracts plain text from .docx files using the mammoth library. All XML markup, styles, and metadata SHALL be stripped, returning only readable text content.

#### Scenario: 正常 .docx 文件解析
- **WHEN** 提供一个有效的 .docx 文件
- **THEN** `parseDocx()` SHALL resolve with the extracted plain text
- **AND** the returned string SHALL NOT contain any XML tags (`<w:...>`, `<a:...>`, etc.)
- **AND** the returned string SHALL NOT be empty for non-empty documents

#### Scenario: 损坏的 .docx 文件
- **WHEN** 提供一个文件扩展名为 .docx 但内容不是有效 ZIP/OOXML 的文件
- **THEN** `parseDocx()` SHALL reject with an Error
- **AND** the error message SHALL include the file name and a Chinese description

#### Scenario: 零字节 .docx 文件
- **WHEN** 提供一个 0 字节的 .docx 文件
- **THEN** `parseDocx()` SHALL resolve with an empty string `""`

### Requirement: XLSX 表格文本提取

The system SHALL provide a `parseXlsx(file: File): Promise<string>` function that reads all sheets of an .xlsx workbook and returns concatenated CSV-like text.

#### Scenario: 单 sheet 工作簿
- **WHEN** 提供一个包含 1 个 sheet（Sheet1）的 .xlsx 文件
- **THEN** `parseXlsx()` SHALL resolve with text in the format:
  ```
  --- Sheet: Sheet1 ---
  {csv content}
  ```
- **AND** the CSV content SHALL use comma (`,`) as delimiter

#### Scenario: 多 sheet 工作簿
- **WHEN** 提供一个包含 "Sheet1"、"Sheet2" 两个 sheet 的 .xlsx 文件
- **THEN** `parseXlsx()` SHALL resolve with text containing both sheet sections separated by blank lines
- **AND** each sheet SHALL be prefixed with `--- Sheet: {name} ---`

#### Scenario: 含空单元格的 sheet
- **WHEN** sheet 包含空单元格
- **THEN** 空单元格 SHALL be rendered as empty string (commas appear but no content between them)

### Requirement: TXT/MD 原生文本读取

The system SHALL provide a `parseTxt(file: File, signal?: AbortSignal): Promise<string>` function that reads .txt and .md files using the browser's native FileReader API without any third-party dependencies.

#### Scenario: 小文件读取（≤ 100KB）
- **WHEN** 提供一个 ≤ 100KB 的 .txt 或 .md 文件
- **THEN** `parseTxt()` SHALL read the entire file in one operation
- **AND** the returned string SHALL equal the file's text content

#### Scenario: 大文件分片读取（> 100KB）
- **WHEN** 提供一个 > 100KB 的 .txt 文件
- **THEN** `parseTxt()` SHALL read the file in 100KB chunks
- **AND** each chunk read SHALL yield the event loop (via `await`) to avoid blocking the UI thread

#### Scenario: 用户取消读取
- **WHEN** `parseTxt()` 正在读取大文件且 `AbortSignal` 被触发
- **THEN** `parseTxt()` SHALL reject immediately
- **AND** the FileReader SHALL be aborted, releasing resources

#### Scenario: UTF-8 编码文本
- **WHEN** 提供一个 UTF-8 编码的 .txt 文件（含中文字符）
- **THEN** `parseTxt()` SHALL read and return the text without garbled characters

### Requirement: 统一解析入口 parseDocument

The system SHALL provide a `parseDocument(file: File, fileType: FileType, signal?: AbortSignal): Promise<string>` function as the single public entry point for all document parsing. It SHALL route to the appropriate parser based on file extension and FileType.

#### Scenario: .docx 路由到 docxParser
- **WHEN** `parseDocument(file, 'word')` is called and `file.name` ends with `.docx`
- **THEN** the function SHALL invoke `parseDocx(file)`
- **AND** the parser module SHALL be loaded via dynamic `import()` (lazy loading)

#### Scenario: .doc 旧格式回退 agent-core
- **WHEN** `parseDocument(file, 'word')` is called and `file.name` ends with `.doc`
- **THEN** the function SHALL invoke `agentFallback(file, 'word')`
- **AND** it SHALL POST the file to `/features/file/parse-document`

#### Scenario: .pptx/.ppt 回退 agent-core
- **WHEN** `parseDocument(file, 'ppt')` is called with any .ppt/.pptx file
- **THEN** the function SHALL invoke `agentFallback(file, 'ppt')`
- **AND** it SHALL POST the file to `/features/file/parse-document`
- **AND** 前端 SHALL NOT attempt local ppt/pptx parsing

### Requirement: 错误处理与用户提示

All parser functions SHALL provide user-friendly Chinese error messages. The `parseDocument` entry point SHALL handle errors uniformly.

#### Scenario: DOCX 解析失败提示
- **WHEN** `parseDocx()` rejects due to corrupted file
- **THEN** the error message SHALL be in Chinese (e.g., "Word 文档解析失败：report.docx")
- **AND** the message SHALL include the original file name

#### Scenario: agent-core 兜底服务不可用
- **WHEN** `agentFallback()` receives HTTP 404 or 502 from `/features/file/parse-document`
- **THEN** the error message SHALL be: "文档解析服务暂不可用，请联系管理员"
- **AND** the function SHALL NOT retry more than once (避免级联超时)

#### Scenario: 未知扩展名处理
- **WHEN** `parseDocument()` receives a file with an unrecognized extension
- **THEN** the function SHALL fall back to `agentFallback()`
- **AND** 前端 SHALL NOT throw or reject based on extension alone

### Requirement: 按需延迟加载

The mammoth and xlsx libraries SHALL only be loaded when they are actually needed (i.e., when a .docx or .xlsx file is uploaded). The first HTML page load SHALL NOT include these libraries in the initial JavaScript bundle.

#### Scenario: 首屏不加载解析库
- **WHEN** the frontend application is loaded and no file upload is triggered
- **THEN** the initial JavaScript bundle SHALL NOT contain mammoth or xlsx code
- **AND** mammoth/xlsx code SHALL be in a separate code-split chunk

#### Scenario: 上传触发按需加载
- **WHEN** the user uploads a .docx file for the first time
- **THEN** the mammoth chunk SHALL be fetched and loaded via dynamic `import()`
- **AND** subsequent .docx uploads SHALL use the cached chunk
