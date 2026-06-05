# Design: 文件上传类型定义与常量配置

## Context

完整功能由 12 个任务组成（见 `openspec/file-upload-tasks(1).md`），本 change 只落地**任务 1**——集中导出类型与常量，避免后续 11 个任务各自重复定义。

文件需具备：
1. **可被前端多个模块复用**（被校验工具 / composable / UI 组件 / utils 同时 import）
2. **限额配置可外部覆盖**（不同租户 / 不同部署环境可能调整限额）
3. **类型与数据分离**（类型 = interface，数据 = 常量对象）

## Goals / Non-Goals

**Goals:**
- 提供单一来源的类型定义（Single Source of Truth）
- 限额常量用 frozen-as-typescript-literal 风格（`as const`），既可枚举也可在 IDE 中跳转到字段
- 类型 + 常量都使用 named export，方便 tree-shake

**Non-Goals:**
- 不写运行时校验逻辑（任务 2 负责）
- 不引入任何 npm 依赖
- 不写单元测试（任务 1 是纯声明性代码，类型层由 TS 编译器保证）

## Decisions

### 决策 1：单文件 vs 多文件

- **选择**: 单文件 `fileUpload.ts`
- **理由**: 任务 1 的产出物总行数预估 < 200 行，单文件便于一次性 import（`import type { FileType, ... } from '@/types/fileUpload'`），也方便后续 reviewer 一眼看完所有契约
- **替代方案**: 拆成 `types.ts` + `constants.ts`。否决——拆分会让"类型 + 它对应的常量"在 IDE 跳转时跨文件，对小规模契约不划算

### 决策 2：限额常量用对象 vs enum

- **选择**: `Record<FileType, number>` 对象
- **理由**:
  - `FileType` 是 string union，TypeScript 不允许 `enum` 作为 key 索引（需要用 string enum 或 type assertion）
  - 对象字面量天然支持 IDE 自动补全 + 跳转
  - JS 运行时可直接用 `FILE_UPLOAD_CONFIG.MAX_COUNT.word` 访问
- **替代方案**: `as const` 数组。否决——索引访问不如对象直观

### 决策 3：`ImageParsedStatus` 用 enum vs union string

- **选择**: TypeScript `enum`
- **理由**: 4 个状态语义固定（`PENDING`/`PARSING`/`PARSED`/`FAILED`），用 enum 让 IDE 跳转更直接，且反编译为对象后可在 runtime 用 `ImageParsedStatus.PARSED`
- **替代方案**: `type ImageParsedStatus = 'PENDING' | 'PARSING' | 'PARSED' | 'FAILED'`。否决——纯 union string 在 runtime 不存在，调试日志里只能看到字符串，不如 enum 反向可查

### 决策 4：图片单文件大小上限

- 文档约束中"图片 - 单文件上限"列为 `-`（无明确值），设计为**默认 5MB**（与 Word 同档）
- 文档约束"图片 - 总大小上限"列为 `-`，设计为**默认 30MB**（10 张 × 5MB ≈ 50MB 取保守值）

## Risks / Trade-offs

- [常量对象在 build 后会被打包进 chunk] → 接受，任务 1 的常量总和 < 1KB（gzip），可忽略
- [类型层与运行时常量耦合] → 接受，两者**理应**同步演进；如未来需要"按租户覆盖"，把 `FILE_UPLOAD_CONFIG` 改成可被 Provider 注入的工厂即可
- [ImageParsedStatus 是 enum，编译后体积略增] → 接受，4 个值的 enum 增量 < 100B

## Migration Plan

- 无迁移成本（纯新增）
- 任务 2/3 等后续 change 引用本文件时，按需 import

## Open Questions

- 任务 5（图片 OCR 客户端）若以后切换到 Java 端实现，`OcrResponse` 的 shape 可能调整；目前 task 1 仅声明占位字段
- `FileUploadConfig` 是否需要在 `OcrResponse` 中也加 `language` 字段？目前选择"加"——给多语言 OCR 留扩展
