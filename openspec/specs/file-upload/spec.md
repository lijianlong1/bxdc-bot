# file-upload Specification

## Purpose
TBD - created by archiving change add-file-upload-types. Update Purpose after archive.
## Requirements
### Requirement: FileType 联合类型

The system SHALL define a `FileType` TypeScript union type with exactly 5 values: `'word' | 'excel' | 'ppt' | 'txt' | 'image'`.

#### Scenario: TypeScript 编译期穷尽性检查
- **WHEN** 业务代码使用 `switch` 语句覆盖全部 5 个 `FileType` 值
- **THEN** TypeScript 编译器 SHALL 不报 `noFallthroughCasesInSwitch` / `not all code paths return value` 错误
- **AND** 若未来新增第 6 个 `FileType` 值，所有未覆盖的 `switch` SHALL 触发编译错误（穷尽性保证）

### Requirement: UploadFileInfo 接口

The system SHALL define a `UploadFileInfo` interface describing the runtime state of a single uploaded file, with required fields: `id`, `file`, `fileName`, `fileType`, `size`, `status`, `uploadedAt`; and optional fields: `parsedText`, `errorMessage`, `previewUrl`, `ocrConfidence`, `compliance`, `decrypt`.

#### Scenario: 上传中文件处于 pending 状态
- **WHEN** 用户选择文件后尚未触发解析
- **THEN** `status` SHALL 处于 `'pending'`
- **AND** `parsedText` / `errorMessage` SHALL 为 `undefined`

#### Scenario: 解析成功的图片含 OCR 置信度
- **WHEN** 图片 OCR 完成
- **THEN** `status` SHALL 变为 `'parsed'`
- **AND** `parsedText` SHALL 包含识别文字
- **AND** `ocrConfidence` SHALL 为 `[0, 1]` 之间的 number

### Requirement: 限额配置 FILE_UPLOAD_CONFIG

The system SHALL export a `FILE_UPLOAD_CONFIG` constant of type `FileUploadConfig` with the following limits:

| FileType | MAX_COUNT | MAX_SIZE_PER_FILE | MAX_TOTAL_SIZE | ACCEPTED_EXTENSIONS |
|----------|-----------|-------------------|----------------|---------------------|
| word     | 3         | 5 MiB             | 15 MiB         | `.doc`, `.docx`     |
| excel    | 2         | 1 MiB             | 2 MiB          | `.xls`, `.xlsx`     |
| ppt      | 3         | 10 MiB            | 30 MiB         | `.ppt`, `.pptx`     |
| txt      | Infinity  | 0.3 MiB           | Infinity       | `.txt`, `.md`       |
| image    | 10        | 5 MiB             | 30 MiB         | `.png`, `.jpg`, `.jpeg`, `.webp` |

#### Scenario: 业务代码按类型读取限额
- **WHEN** 校验工具读取 word 类型限额
- **THEN** `FILE_UPLOAD_CONFIG.MAX_COUNT.word` SHALL 等于 `3`
- **AND** `FILE_UPLOAD_CONFIG.MAX_SIZE_PER_FILE.word` SHALL 等于 `5 * 1024 * 1024`
- **AND** `FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS.word` SHALL 是 `['.doc', '.docx']`

#### Scenario: txt 类型的无限额
- **WHEN** 业务代码读取 txt 类型数量上限
- **THEN** `FILE_UPLOAD_CONFIG.MAX_COUNT.txt` SHALL 等于 `Infinity`
- **AND** 校验逻辑 SHALL 跳过 txt 数量检查（视为不限）

### Requirement: 校验 / 合规 / 解密结果类型

The system SHALL define three result interfaces, each with explicit `valid` / `passed` / `success` boolean and human-readable message field:

- `FileValidationResult`: `{ valid: boolean; errors: string[]; warnings: string[] }`
- `FileComplianceResult`: `{ passed: boolean; message: string; sensitiveWords?: string[] }`
- `FileDecryptResult`: `{ success: boolean; content: string; errorMessage?: string }`

#### Scenario: 校验失败的错误聚合
- **WHEN** 单个文件触发 2 条 error
- **THEN** `errors` 数组 SHALL 包含这 2 条错误信息
- **AND** `valid` SHALL 为 `false`

#### Scenario: 合规检查命中敏感词
- **WHEN** 文件内容包含 2 个敏感词
- **THEN** `passed` SHALL 为 `false`
- **AND** `sensitiveWords` SHALL 包含这 2 个词

### Requirement: OCR 与图片解析状态类型

The system SHALL define `OcrResponse` interface and `ImageParsedStatus` enum.

`OcrResponse`: `{ text: string; confidence: number; language?: string; blocks?: Array<{ text: string; confidence: number; bbox?: number[] }> }`

`ImageParsedStatus`: enum with values `PENDING`, `PARSING`, `PARSED`, `FAILED`.

#### Scenario: OCR 响应包含识别文字
- **WHEN** agent-core 返回 OCR 结果
- **THEN** `text` SHALL 为识别出的字符串
- **AND** `confidence` SHALL 为 `[0, 1]` 之间的数字
- **AND** `language` 和 `blocks` 为可选字段，缺失时业务代码 SHALL 优雅降级（按 `text` 即可）

#### Scenario: 图片解析失败
- **WHEN** agent-core 端 OCR 调用失败
- **THEN** 业务代码 SHALL 设置 `status: 'failed'` 且 `errorMessage` 非空
- **AND** 若使用 `ImageParsedStatus` 枚举，状态 SHALL 为 `ImageParsedStatus.FAILED`

### Requirement: 展示辅助常量

The system SHALL export `FILE_TYPE_LABELS`, `FILE_TYPE_ICONS`, and `FILE_INPUT_ACCEPT` constants:

- `FILE_TYPE_LABELS`: 中文展示名（如 `'word' -> 'Word 文档'`）
- `FILE_TYPE_ICONS`: emoji 图标
- `FILE_INPUT_ACCEPT`: 逗号拼接的全部扩展名（用于 `<input type="file" accept="...">`）

#### Scenario: 拼接 accept 字符串
- **WHEN** 业务代码使用 `FILE_INPUT_ACCEPT` 作为 `<input>` 的 accept 属性
- **THEN** SHALL 包含全部 5 个 FileType 的扩展名（`.doc,.docx,.xls,.xlsx,...,.webp`）
- **AND** SHALL 不包含通配符（仅列具体扩展名）

