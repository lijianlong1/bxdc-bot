# Tasks: add-document-parsers（任务 4：文档内容解析器）

## 1. 依赖安装

- [x] 1.1 在 `frontend` 目录安装 npm 依赖：`npm install mammoth xlsx`
  - `mammoth`：.docx 纯文本提取
  - `xlsx`（SheetJS 社区版）：.xlsx 表格文本读取
- [x] 1.2 验证安装：`ls node_modules/mammoth/mammoth.browser.js` 和 `ls node_modules/xlsx/xlsx.js` 均存在
- [x] 1.3 运行 `npx tsc --noEmit` 确认类型检查通过（新依赖有内置类型或 @types 包）

## 2. DOCX 解析器

- [x] 2.1 新建 `frontend/src/utils/docxParser.ts`
- [x] 2.2 实现 `parseDocx(file: File): Promise<string>`：
  - 使用 `file.arrayBuffer()` 读取文件
  - 调用 `mammoth.extractRawText({ arrayBuffer })` 提取文本
  - 返回 `result.value`（纯文本字符串）
  - 解析失败时抛出含中文描述的 Error（`Word 文档解析失败：xxx.docx`）
- [x] 2.3 处理边界：文件为 0 字节时返回空字符串；文件格式损坏时 mammoth 自身抛异常，包装为友好错误

## 3. XLSX 解析器

- [x] 3.1 新建 `frontend/src/utils/xlsxParser.ts`
- [x] 3.2 实现 `parseXlsx(file: File): Promise<string>`：
  - 使用 `file.arrayBuffer()` 读取文件
  - 调用 `XLSX.read(data, { type: 'array' })` 解析
  - 遍历 `workbook.SheetNames`，对每个 sheet 调用 `XLSX.utils.sheet_to_csv(sheet)`
  - 将所有 sheet 拼接为 `--- Sheet: {name} ---\n{csv}\n\n` 格式
  - 解析失败时抛出含中文描述的 Error
- [x] 3.3 处理边界：单 sheet 工作簿（最常见场景）仅输出一个 sheet 内容；空单元格处理为空白

## 4. TXT/MD 解析器

- [x] 4.1 新建 `frontend/src/utils/txtParser.ts`
- [x] 4.2 实现 `parseTxt` File, signal?: AbortSignal): Promise<string>`：
  - 使用 `FileReader.readAsText(file, 'UTF-8')` 读取
  - 支持 `AbortSignal`：用户取消上传时中断读取
  - 大文件（> 100KB）分片读取：每片 100KB，`File.slice()` + `await` 释放主线程
  - 返回完整文本字符串
- [x] 4.3 处理边界：编码检测 → 默认 UTF-8，若含乱码尝试 GBK 回退（用 `TextDecoder` 手动解码）

## 5. 统一入口 fileParser.ts

- [x] 5.1 新建 `frontend/src/utils/fileParser.ts`
- [x] 5.2 实现 `agentFallback` File, fileType: FileType): Promise<string>`：
  - 用 `FormData` 包装文件，追加 `fileType` 字段
  - POST 到 `/features/file/parse-document`（由任务 9 提供端点）
  - 超时 30 秒，超时或网络错误抛友好提示
  - 任务 9 未就绪时返回明确错误："文档解析服务暂不可用，请联系管理员"
- [x] 5.3 实现路由函数 `parseDocument(file: File, fileType: FileType, signal?: AbortSignal): Promise<string>`：
  - 根据 `file.name` 扩展名 + `fileType` 路由到对应解析器
  - 路由表：
    | 扩展名 | fileType | 解析器 |
    |--------|----------|--------|
    | .docx | word | `parseDocx()` |
    | .doc | word | `agentFallback()` |
    | .xlsx | excel | `parseXlsx()` |
    | .xls | excel | `agentFallback()` |
    | .ppt/.pptx | ppt | `agentFallback()` |
    | .txt/.md | txt | `parseTxt(file, signal)` |
  - 未知扩展名 fallback 到 `agentFallback()`
- [x] 5.4 使用动态 `import()` 延迟加载各 parser，避免首屏加载 mammoth/xlsx
  ```typescript
  if (ext === '.docx') {
    const { parseDocx } = await import('./docxParser')
    return parseDocx(file)
  }
  ```
- [x] 5.5 导出 `parseDocument` 作为模块唯一公开 API

## 6. 验证测试

- [x] 6.1 安装测试依赖：无额外依赖（使用已有 vitest）
- [x] 6.2 `npx tsc --noEmit` 确保类型编译无错误
- [x] 6.3 功能验证（手工，待后续集成测试覆盖）：
  - 上传 .docx 文件，确认 `parseDocument()` 返回纯文本且不含 XML 标签
  - 上传 .xlsx 文件，确认返回多 sheet CSV 拼接文本
  - 上传 .txt/.md 文件，确认返回原始文本内容
  - 上传 .doc 旧格式，确认走 `agentFallback()` 路径
  - 上传 .pptx 文件，确认走 `agentFallback()` 路径
  - 取消上传（AbortSignal），确认 TXT 读取中断

## 7. 构建验证

- [x] 7.1 运行 `npm run build`，确认：
  - mammoth/xlsx 被 code-split 为独立 chunk（首屏 chunk 不含 mammoth/xlsx 代码）
  - 总打包体积增量在预期范围内（mammoth ~150KB + xlsx ~300KB gzip）
- [x] 7.2 运行 `npm run test`，确认已有测试全部通过
