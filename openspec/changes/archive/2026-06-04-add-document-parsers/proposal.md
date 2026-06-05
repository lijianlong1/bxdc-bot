# Add: 聊天框文件上传 — 文档内容解析器（任务 4）

## Why

聊天框文件上传功能整体拆分为 12 个任务。任务 1（类型定义与常量配置）已交付，提供了 `FileType` / `UploadFileInfo` / `FILE_UPLOAD_CONFIG` 等基础契约。当前需要实现**任务 4：文档内容解析器（前端版）**——当用户在聊天框上传 Word / Excel / PPT / TXT / MD 文件后，系统需要在前端提取文件中的纯文本内容，供后续拼接进大模型 message。

文档解析必须在用户点击发送前完成，直接阻塞消息发送流程，因此解析器的正确性和性能直接影响用户体验。优先在前端完成新格式文档（.docx / .xlsx）的解析，旧格式（.doc / .xls / .ppt）和 PPTX 格式回退 agent-core 兜底。

## What Changes

- **add(frontend)**: 新建 `frontend/src/utils/docxParser.ts` — 使用 mammoth 库提取 .docx 文件纯文本
- **add(frontend)**: 新建 `frontend/src/utils/xlsxParser.ts` — 使用 xlsx（SheetJS）库提取 .xlsx 文件各 sheet 文本
- **add(frontend)**: 新建 `frontend/src/utils/txtParser.ts` — 使用原生 FileReader 读取 .txt/.md 文件内容
- **add(frontend)**: 新建 `frontend/src/utils/fileParser.ts` — 统一入口，根据 `FileType` 路由到对应解析器；不可前端处理的格式回退 agent-core `/features/file/parse-document`
- **add(frontend)**: 新增 npm 依赖 `mammoth`（docx 解析，~150KB gzip）、`xlsx`（SheetJS，~300KB gzip）
- **no-change(backend)**: agent-core `/features/file/parse-document` 端点将由任务 9 新建，本任务仅在前端封装回退调用

## Capabilities

### New Capabilities

- `document-parsers`: 前端文档内容解析能力，支持 .docx（mammoth）、.xlsx（SheetJS）、.txt/.md（FileReader）的文字提取；不支持解析的格式（.ppt/.pptx/.doc/.xls）回退 agent-core 处理

### Modified Capabilities

（无）

## Impact

- **新增文件**: `frontend/src/utils/docxParser.ts` / `xlsxParser.ts` / `txtParser.ts` / `fileParser.ts`
- **新增依赖**: `mammoth`、`xlsx`（npm install）
- **依赖任务**: 任务 1（类型 + 常量，已完成）
- **被依赖任务**: 任务 3（useFileUpload composable 将调用本模块的 `parseDocument()`）、任务 9（agent-core `/features/file/parse-document` 兜底端点）
- **PPTX 策略**: .pptx 不在前端解析（需引入 JSZip + XML 解析链，违反尽量使用已有依赖的原则），回退 agent-core
- **不影响已有功能**: 纯新增工具模块，不修改任何已有文件
