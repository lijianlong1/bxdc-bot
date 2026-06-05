## 1. 状态结构与 provide/inject

- [ ] 1.1 定义 `FileUploadState` 接口和 `FileUploadKey` InjectionKey
- [ ] 1.2 实现 `provideFileUpload()` 函数
- [ ] 1.3 实现 `useFileUpload()` 函数（无 provider 时降级返回本地状态）
- [ ] 1.4 初始化 `uploadedFiles` 为 5 个 FileType 的空数组 record

## 2. 核心方法

- [ ] 2.1 实现 `addFiles(files: File[])` 方法
  - [ ] 2.1.1 遍历文件调用 `getFileTypeFromName` 识别 FileType
  - [ ] 2.1.2 对每个文件调用 `validateFile`（任务 2）进行格式/大小/加密校验
  - [ ] 2.1.3 校验累计大小（`validateTotalSize`）
  - [ ] 2.1.4 校验数量（`validateFileCount`）
  - [ ] 2.1.5 校验通过则 push 到对应 `uploadedFiles[fileType]`
  - [ ] 2.1.6 校验失败调用 `MessagePlugin.error` 展示具体错误
  - [ ] 2.1.7 image 类型额外生成 `previewUrl`（`URL.createObjectURL`）
- [ ] 2.2 实现 `removeFile(fileId: string)` 方法
- [ ] 2.3 实现 `clearFiles()` 方法
  - [ ] 2.3.1 遍历 `uploadedFiles` 调用 `URL.revokeObjectURL` 释放所有 `previewUrl`
  - [ ] 2.3.2 重置 5 个分组为空数组

## 3. 汇总方法

- [ ] 3.1 实现 `getAllParsedText()` 方法
  - [ ] 3.1.1 过滤 `status === 'parsed'` 的文件
  - [ ] 3.1.2 用 `\n\n--- 文件：${fileName} ---\n` 分隔拼接 `parsedText`
- [ ] 3.2 实现 `getFileNamesForMemory()` 方法
  - [ ] 3.2.1 遍历 `uploadedFiles` 所有分组收集 `fileName`

## 4. 解析占位

- [ ] 4.1 实现 `parseFileContent(file: UploadFileInfo)` 占位方法
  - [ ] 4.1.1 如 `status === 'parsed'` 直接返回 `parsedText`
  - [ ] 4.1.2 切到 `'parsing'` 状态
  - [ ] 4.1.3 暂不实现实际解析（任务 4-5 完成后回填）
  - [ ] 4.1.4 占位返回空字符串，保持 status 为 'parsing'（等待任务 4 解析函数）
  - [ ] 4.1.5 异常时切到 `'failed'` 并填充 `errorMessage`
- [ ] 4.2 在文件 `useFileUpload.ts` 顶部注释中标注 "解析占位，任务 4-5 完成"

## 5. 验证

- [ ] 5.1 运行 `npx vue-tsc --noEmit` 确保编译通过
- [ ] 5.2 验证 provide/inject 模式与 `useChat` 一致
