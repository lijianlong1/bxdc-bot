## Context

文件上传功能的任务 2：文件校验工具。当前 `frontend/src/types/fileUpload.ts` 已定义 `FileType`、`FILE_UPLOAD_CONFIG`、`FileValidationResult` 等类型和常量，需要基于这些实现纯函数校验工具。项目为 Vue 3 + TypeScript，前端校验逻辑不依赖后端。

## Goals / Non-Goals

**Goals:**
- 实现扩展名 → FileType 映射函数
- 实现单文件格式、大小校验
- 实现同类型累计大小、数量校验
- 提供组合校验函数，一次调用完成全部校验
- 加密文件检测（魔数检测）

**Non-Goals:**
- 不包含文件解析（任务 4）
- 不包含 OCR（任务 5）
- 不包含 UI 组件（任务 6）
- 不包含合规审计（任务 10）

## Decisions

1. **纯函数设计**：所有校验函数为纯函数，输入 File / UploadFileInfo[]，输出 FileValidationResult。不依赖 Vue 响应式系统，便于单元测试。

2. **扩展名映射使用 FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS**：不硬编码扩展名列表，而是遍历配置的 `ACCEPTED_EXTENSIONS` 反向查找。这样当未来 FILE_UPLOAD_CONFIG 变更时无需修改 validator。

3. **组合校验 `validateFile()` 仅校验单文件**：格式校验 + 大小校验 + 加密检测。同类型累计大小和数量由调用方（useFileUpload）在 `addFiles` 时通过对应的独立函数自行判断，保持函数单一职责。

4. **加密检测仅检测常见格式**：检测 .doc/.xls/.ppt（OLE 复合文档）和 .docx/.xlsx/.pptx（ZIP 包装）的加密标志位。不覆盖所有加密文件类型，非加密场景返回 `valid: true`。

5. **不引入额外依赖**：所有逻辑使用浏览器原生 API（File、FileReader），零 npm 依赖。

## Risks / Trade-offs

- [Risk] 加密检测覆盖不全 → 仅检测 Office 文件加密魔数，其他加密格式（如 PDF 加密）不在范围内
- [Risk] 扩展名大小写 → 统一转小写处理，兼容 `.JPG` / `.Jpg` 等变体
- [Trade-off] 同类型累计校验置于组合函数外部 → 调用方需额外调用 `validateTotalSize` / `validateFileCount`，但保持了函数纯度
