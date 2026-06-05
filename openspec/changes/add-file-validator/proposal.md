## Why

文件上传功能需要前端校验工具来验证用户选择的文件是否满足格式、大小、数量限制，并在解析前提供明确的错误反馈。当前 `fileUpload.ts` 中已定义了类型和限额常量，但缺少校验实现。

## What Changes

- 新增 `frontend/src/utils/fileValidator.ts`，实现文件校验工具函数
- 根据扩展名映射到 `FileType` 类型
- 校验格式是否在允许列表中
- 校验单文件大小、同类型累计大小、同类型数量
- 组合校验函数 `validateFile()`，返回 `FileValidationResult`
- 加密文件检测（魔数判断）
- 纯新增文件，不修改已有代码

## Capabilities

### New Capabilities
- `file-validator`: 文件校验工具，提供文件格式/大小/数量/加密检测能力

### Modified Capabilities
- `file-upload`: 新增校验工具依赖的 FileType 和 FILE_UPLOAD_CONFIG 已就绪，无需修改

## Impact

- 新增文件：`frontend/src/utils/fileValidator.ts`
- 依赖：`frontend/src/types/fileUpload.ts`（已存在，无需修改）
- 纯前端工具函数，不涉及后端或外部依赖
