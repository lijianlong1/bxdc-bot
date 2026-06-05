# Tasks: add-file-upload-types（仅任务 1：类型 + 常量）

## 1. 类型定义

- [x] 1.1 定义 `FileType` 联合类型：`'word' | 'excel' | 'ppt' | 'txt' | 'image'`
- [x] 1.2 定义 `UploadFileInfo` 接口：id / file / fileName / fileType / size / status / parsedText? / errorMessage? / previewUrl? / ocrConfidence? / compliance? / decrypt? / uploadedAt
- [x] 1.3 定义 `FileValidationResult` 接口：valid / errors[] / warnings[]
- [x] 1.4 定义 `FileComplianceResult` 接口：passed / message / sensitiveWords?
- [x] 1.5 定义 `FileDecryptResult` 接口：success / content / errorMessage?
- [x] 1.6 定义 `OcrResponse` 接口：text / confidence / language? / blocks?（含 bbox）
- [x] 1.7 定义 `ImageParsedStatus` enum：PENDING / PARSING / PARSED / FAILED

## 2. 常量配置

- [x] 2.1 定义 `FileUploadConfig` 接口（MAX_COUNT / MAX_SIZE_PER_FILE / MAX_TOTAL_SIZE / ACCEPTED_EXTENSIONS 都按 `Record<FileType, ...>` 形式）
- [x] 2.2 导出 `FILE_UPLOAD_CONFIG` 常量：word 3/5MB/15MB、excel 2/1MB/2MB、ppt 3/10MB/30MB、txt ∞/0.3MB/∞、image 10/5MB/30MB
- [x] 2.3 导出 `ACCEPTED_EXTENSIONS`：word[.doc,.docx]、excel[.xls,.xlsx]、ppt[.ppt,.pptx]、txt[.txt,.md]、image[.png,.jpg,.jpeg,.webp]

## 3. 展示辅助

- [x] 3.1 导出 `FILE_TYPE_LABELS`（中文名：Word 文档 / Excel 表格 / PPT 演示 / 文本或 Markdown / 图片）
- [x] 3.2 导出 `FILE_TYPE_ICONS`（emoji：📄 / 📊 / 📽️ / 📝 / 🖼️）
- [x] 3.3 导出 `FILE_INPUT_ACCEPT`（全部扩展名逗号拼接，`<input type="file">` 用）

## 4. 验证

- [x] V.1 `npx tsc --noEmit` 通过（types 编译无错）
- [x] V.2 文件存在 `frontend/src/types/fileUpload.ts`，可被 `frontend/src/composables/useFileUpload.ts` 等后续任务 import
- [x] V.3 限额表与 spec 中表格逐项对齐（5 行 × 4 列）
