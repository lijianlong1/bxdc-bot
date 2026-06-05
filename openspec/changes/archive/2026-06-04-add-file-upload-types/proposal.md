# Add: 文件上传功能的类型定义与常量配置

## Why

聊天框即将支持文件上传（Word/Excel/PPT/TXT/MD/图片），后续的校验、解析、状态管理、上传 UI、合规审计等 11 个任务都依赖一套统一的 TypeScript 类型和限额常量。本任务（任务 1）只产出**类型层 + 常量层**——不涉及运行时逻辑——为后续任务提供"零业务依赖"的基础，避免后续 11 个任务各自重复定义 `FileType`、`UploadFileInfo`、`MAX_SIZE_PER_FILE` 等容易漂移的类型。

## What Changes

- **add(frontend)**: 新建 `frontend/src/types/fileUpload.ts`，集中导出：
  - `FileType` 联合类型（5 个值）
  - `UploadFileInfo` / `FileValidationResult` / `FileComplianceResult` / `FileDecryptResult` / `OcrResponse` 接口
  - `ImageParsedStatus` 枚举
  - `FILE_UPLOAD_CONFIG` 常量（MAX_COUNT / MAX_SIZE_PER_FILE / MAX_TOTAL_SIZE / ACCEPTED_EXTENSIONS）
  - `FILE_TYPE_LABELS` / `FILE_TYPE_ICONS` 展示辅助常量
  - `FILE_INPUT_ACCEPT` `<input type="file">` accept 字符串

## Capabilities

### New Capabilities

- `file-upload`: 文件上传功能的类型契约与限额配置（仅任务 1；其余 11 个任务将作为后续 OpenSpec change 增量添加）

### Modified Capabilities

（无）

## Impact

- **新增文件**: `frontend/src/types/fileUpload.ts`（纯新增，不修改任何已有文件）
- **依赖**: 无新增 npm 依赖
- **运行时影响**: 0（纯类型层，常量在 build 时会被 tree-shake 进 chunk 或保留——`FILE_UPLOAD_CONFIG` 是对象常量，会被打包；不需要的字段可以单独 import）
- **后续任务**: 任务 2（文件校验工具）、任务 3（useFileUpload composable）等都会 import 此文件
