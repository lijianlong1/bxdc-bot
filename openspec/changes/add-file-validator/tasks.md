## 1. 扩展名映射与基础校验

- [ ] 1.1 实现 `getFileTypeFromName(fileName: string): FileType | null` — 遍历 `FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS` 反向查找，扩展名转小写匹配
- [ ] 1.2 实现 `validateFileExtension(file: File): FileValidationResult` — 调用 `getFileTypeFromName`，不匹配时返回 error

## 2. 大小与数量校验

- [ ] 2.1 实现 `validateFileSize(file: File, fileType: FileType): FileValidationResult` — 对比 `FILE_UPLOAD_CONFIG.MAX_SIZE_PER_FILE`
- [ ] 2.2 实现 `validateTotalSize(files: File[], fileType: FileType): FileValidationResult` — 累计已有文件 + 新文件的 size 对比 `MAX_TOTAL_SIZE`
- [ ] 2.3 实现 `validateFileCount(files: File[], fileType: FileType): FileValidationResult` — 已有文件数量 + 1 对比 `MAX_COUNT`

## 3. 加密检测

- [ ] 3.1 实现 `isEncryptedFile(file: File): Promise<boolean>` — 读文件头魔数检测 Office 加密
- [ ] 3.2 OLE 格式检测 (.doc/.xls/.ppt)：读取前 512 字节，检测 EncryptionInfo 流标记
- [ ] 3.3 ZIP 格式检测 (.docx/.xlsx/.pptx)：解压 ZIP entry 检测 EncryptionInfo

## 4. 组合校验与导出

- [ ] 4.1 实现 `validateFile(file: File, existingFiles: UploadFileInfo[]): FileValidationResult` — 组合扩展名 + 大小 + 加密校验
- [ ] 4.2 错误信息使用 `FILE_TYPE_LABELS` 展示友好中文提示
- [ ] 4.3 文件大小以 MiB 格式化展示（保留 2 位小数）
- [ ] 4.4 导出所有公共函数
