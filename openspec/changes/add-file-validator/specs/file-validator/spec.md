## ADDED Requirements

### Requirement: 扩展名到 FileType 映射

The system SHALL provide `getFileTypeFromName(fileName: string): FileType | null` function that maps a file extension to its corresponding `FileType`.

#### Scenario: 已知扩展名映射成功
- **WHEN** 传入 `"report.docx"`
- **THEN** 返回 `"word"`

#### Scenario: 未知扩展名返回 null
- **WHEN** 传入 `"video.mp4"`
- **THEN** 返回 `null`

#### Scenario: 扩展名大小写不敏感
- **WHEN** 传入 `"IMAGE.PNG"`
- **THEN** 返回 `"image"`

### Requirement: 单文件格式校验

The system SHALL provide `validateFileExtension(file: File): FileValidationResult` function that checks whether the file extension is in `FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS`.

#### Scenario: 支持的文件格式
- **WHEN** 传入 `.docx` 文件
- **THEN** 返回 `{ valid: true, errors: [], warnings: [] }`

#### Scenario: 不支持的文件格式
- **WHEN** 传入 `.mp4` 文件
- **THEN** 返回 `{ valid: false, errors: ["不支持的文件格式：.mp4"], warnings: [] }`

### Requirement: 单文件大小校验

The system SHALL provide `validateFileSize(file: File, fileType: FileType): FileValidationResult` function that checks whether the file size exceeds `FILE_UPLOAD_CONFIG.MAX_SIZE_PER_FILE[fileType]`.

#### Scenario: 文件大小在限额内
- **WHEN** word 类型文件大小为 3 MiB（限额 5 MiB）
- **THEN** 返回 `{ valid: true, errors: [], warnings: [] }`

#### Scenario: 文件大小超出限额
- **WHEN** excel 类型文件大小为 2 MiB（限额 1 MiB）
- **THEN** 返回 `{ valid: false, errors: ["文件大小超过上限（上限 1.00 MiB，当前 2.00 MiB）"], warnings: [] }`

### Requirement: 同类型累计大小校验

The system SHALL provide `validateTotalSize(files: File[], fileType: FileType): FileValidationResult` function that checks whether the total size of the given files plus the fileType does not exceed `FILE_UPLOAD_CONFIG.MAX_TOTAL_SIZE[fileType]`.

#### Scenario: 累计大小在限额内
- **WHEN** image 类型已上传 10 MiB，当前文件 5 MiB（限额 30 MiB）
- **THEN** 返回 `{ valid: true, errors: [], warnings: [] }`

#### Scenario: 累计大小超出限额
- **WHEN** image 类型已上传 28 MiB，当前文件 5 MiB（限额 30 MiB）→ 累计 33 MiB
- **THEN** 返回 `{ valid: false, errors: ["图片总大小超过上限（上限 30.00 MiB）"], warnings: [] }`

### Requirement: 同类型数量校验

The system SHALL provide `validateFileCount(files: File[], fileType: FileType): FileValidationResult` function that checks whether the count of the given files plus one does not exceed `FILE_UPLOAD_CONFIG.MAX_COUNT[fileType]`.

#### Scenario: 数量在限额内
- **WHEN** word 类型已上传 1 个文件（限额 3 个）
- **THEN** 返回 `{ valid: true, errors: [], warnings: [] }`

#### Scenario: 数量超出限额
- **WHEN** word 类型已上传 3 个文件（限额 3 个），当前新增 1 个
- **THEN** 返回 `{ valid: false, errors: ["Word 文档数量超过上限（上限 3 个）"], warnings: [] }`

### Requirement: 组合校验

The system SHALL provide `validateFile(file: File, existingFiles: UploadFileInfo[]): FileValidationResult` function that performs extension validation, size validation, and encrypted file detection in a single call.

#### Scenario: 新文件通过全部校验
- **WHEN** 新文件格式支持、大小不超限、非加密文件、累计不超限
- **THEN** 返回 `{ valid: true, errors: [], warnings: [] }`

#### Scenario: 格式校验失败后短路不继续
- **WHEN** 新文件格式不支持
- **THEN** 返回 `{ valid: false, errors: [...] }`，errors 仅包含格式错误（避免继续累加无意义的错误信息）

#### Scenario: 多个校验同时失败
- **WHEN** 新文件大小超限且为加密文件
- **THEN** 返回 `{ valid: false, errors: [...] }`，errors 包含所有检测到的错误

### Requirement: 加密文件检测

The system SHALL provide `isEncryptedFile(file: File): Promise<boolean>` function that reads the file header bytes to determine if it is an encrypted Office document.

#### Scenario: 检测到加密的 .doc 文件
- **WHEN** .doc 文件的 OLE header 中包含 EncryptionInfo 流标记
- **THEN** 返回 `true`

#### Scenario: 检测到非加密文件
- **WHEN** .txt 文件
- **THEN** 返回 `false`

#### Scenario: 加密检测失败静默降级
- **WHEN** FileReader 读取文件头过程中发生异常
- **THEN** 返回 `false`（不阻塞上传流程）
