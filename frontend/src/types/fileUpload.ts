/**
 * 文件上传功能 - 类型定义与常量配置
 *
 * 任务 1（add-file-upload-types）产出物。
 * 集中导出所有文件上传相关的 TypeScript 类型、限额常量、辅助展示字段。
 * 后续任务（校验、解析、composable、UI、合规、解密、agent-core 端点）均依赖本文件。
 *
 * @module types/fileUpload
 */

// ============================================================
// 1. 核心联合类型
// ============================================================

/**
 * 文件类型分类。共 5 个值，新增值时所有 `switch (fileType)` 处需补全分支。
 */
export type FileType = 'word' | 'excel' | 'ppt' | 'txt' | 'image';

// ============================================================
// 2. 运行时文件信息接口
// ============================================================

/**
 * 单个已上传文件在 UI 层 / composable 层的运行时状态。
 *
 * 必填字段在用户选择文件后即有值；可选字段在解析/合规/解密过程中按需填充。
 */
export interface UploadFileInfo {
  /** 唯一 ID（前端 UUID 或时间戳 + 随机数），用于 v-for key 与列表移除 */
  id: string;
  /** 原始 File 对象（仅在内存持有，不落盘） */
  file: File;
  /** 原始文件名（不含路径） */
  fileName: string;
  /** 文件分类，与 FILE_UPLOAD_CONFIG 的键对齐 */
  fileType: FileType;
  /** 文件字节数 */
  size: number;

  /**
   * 状态机：
   * - pending：已选择，未开始解析
   * - parsing：正在解析
   * - parsed：解析成功，parsedText 可用
   * - failed：解析失败，errorMessage 可用
   * - skipped：用户主动跳过 / 解析超时，文件不参与本次对话
   */
  status: 'pending' | 'parsing' | 'parsed' | 'failed' | 'skipped';

  /** 解析后的纯文本内容（仅 parsed 状态时有值） */
  parsedText?: string;
  /** 解析/上传错误信息（仅 failed 状态时有值） */
  errorMessage?: string;
  /** 解析内容是否被截断（超过 PARSED_TEXT_MAX_BYTES 或总大小限制），仅 parsed 状态时相关 */
  truncated?: boolean;

  /** 图片预览 URL（仅 image 类型，由 URL.createObjectURL 生成） */
  previewUrl?: string;
  /** 图片 OCR 置信度，[0, 1] 之间的小数 */
  ocrConfidence?: number;

  /** 合规审计结果（任务 10 启用后填充） */
  compliance?: FileComplianceResult;
  /** 解密结果（任务 10 启用后填充） */
  decrypt?: FileDecryptResult;

  /** 上传时间戳（毫秒），用于排序与超时判断 */
  uploadedAt: number;
}

// ============================================================
// 3. 校验 / 合规 / 解密 结果接口
// ============================================================

/**
 * 文件校验结果。校验失败的 errors 数组用于弹窗展示，warnings 用于温和提示（如"接近单文件上限"）。
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 文件合规审计结果（任务 10 接入 Java 合规接口后填充）。
 * - passed=false 表示文件包含敏感词，不应继续处理
 * - sensitiveWords 列出命中的敏感词
 */
export interface FileComplianceResult {
  passed: boolean;
  message: string;
  sensitiveWords?: string[];
}

/**
 * 加密文件解密结果（任务 10 接入 Java 解密接口后填充）。
 * - success=false 时 content 为空字符串，errorMessage 描述失败原因
 */
export interface FileDecryptResult {
  success: boolean;
  content: string;
  errorMessage?: string;
}

// ============================================================
// 4. OCR 与图片解析状态
// ============================================================

/**
 * agent-core / Java 端 OCR 接口的统一返回结构。
 * - 简单实现只填 text + confidence 即可
 * - blocks 可选，用于 UI 高亮识别区域
 */
export interface OcrResponse {
  text: string;
  /** 识别置信度，[0, 1] 之间的小数 */
  confidence: number;
  /** 识别语种（如 'zh-CN' / 'en'），可选 */
  language?: string;
  /** 识别块（带 bbox 坐标），用于在原图上画框 */
  blocks?: Array<{
    text: string;
    confidence: number;
    /** [x1, y1, x2, y2] 像素坐标 */
    bbox?: number[];
  }>;
}

/**
 * 图片解析状态机的联合类型。
 * 与 UploadFileInfo.status 的 'pending' | 'parsing' | 'parsed' | 'failed' 一一对应。
 * （项目 tsconfig 启用了 `erasableSyntaxOnly`，不允许用 TS enum，所以采用 union string。）
 */
export type ImageParsedStatus = 'PENDING' | 'PARSING' | 'PARSED' | 'FAILED';

/** 状态值常量对象，便于 IDE 跳转与 runtime 反查 */
export const ImageParsedStatus = {
  PENDING: 'PENDING',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  FAILED: 'FAILED',
} as const satisfies Record<ImageParsedStatus, ImageParsedStatus>;

// ============================================================
// 5. 限额配置（FileUploadConfig 接口 + FILE_UPLOAD_CONFIG 常量）
// ============================================================

/**
 * 限额配置结构。4 个字段都是 `Record<FileType, ...>`，便于 IDE 自动补全与穷尽性检查。
 *
 * 数字单位：
 * - MAX_SIZE_PER_FILE / MAX_TOTAL_SIZE 单位为**字节**（byte）
 * - MAX_COUNT 单位为**个**（Infinity 表示不限）
 */
export interface FileUploadConfig {
  MAX_COUNT: Record<FileType, number>;
  MAX_SIZE_PER_FILE: Record<FileType, number>;
  MAX_TOTAL_SIZE: Record<FileType, number>;
  ACCEPTED_EXTENSIONS: Record<FileType, string[]>;
}

/** MiB → bytes 转换（1 MiB = 1024 * 1024） */
const MIB = 1024 * 1024;

/**
 * 限额常量。修改此处即可调整所有上传入口的限额，**不要在业务代码中硬编码数字**。
 *
 * 限额表（与 `specs/file-upload/spec.md` 中表格逐项对齐）：
 *
 * | FileType | MAX_COUNT | MAX_SIZE_PER_FILE | MAX_TOTAL_SIZE | ACCEPTED_EXTENSIONS |
 * |----------|-----------|-------------------|----------------|---------------------|
 * | word     | 3         | 5 MiB             | 15 MiB         | .doc, .docx         |
 * | excel    | 2         | 1 MiB             | 2 MiB          | .xls, .xlsx         |
 * | ppt      | 3         | 10 MiB            | 30 MiB         | .ppt, .pptx         |
 * | txt      | Infinity  | 0.3 MiB           | Infinity       | .txt, .md           |
 * | image    | 10        | 5 MiB             | 30 MiB         | .png, .jpg, .jpeg, .webp |
 */
export const FILE_UPLOAD_CONFIG: FileUploadConfig = {
  MAX_COUNT: {
    word: 3,
    excel: 2,
    ppt: 3,
    txt: Number.POSITIVE_INFINITY,
    image: 10,
  },
  MAX_SIZE_PER_FILE: {
    word: 5 * MIB,
    excel: 1 * MIB,
    ppt: 10 * MIB,
    txt: 0.3 * MIB,
    image: 5 * MIB,
  },
  MAX_TOTAL_SIZE: {
    word: 15 * MIB,
    excel: 2 * MIB,
    ppt: 30 * MIB,
    txt: Number.POSITIVE_INFINITY,
    image: 30 * MIB,
  },
  ACCEPTED_EXTENSIONS: {
    word: ['.doc', '.docx'],
    excel: ['.xls', '.xlsx'],
    ppt: ['.ppt', '.pptx'],
    txt: ['.txt', '.md'],
    image: ['.png', '.jpg', '.jpeg', '.webp'],
  },
};

// ============================================================
// 6. 解析文本长度限额（任务 pass-parsed-content-to-llm）
// ============================================================

/**
 * 单文件解析结果的最大字节数。超过此值会被截断到该上限，并追加 `[内容已截断，原 X KB]` 标记。
 * 单位：字节（UTF-8 编码后），80KB ≈ 20K 汉字。
 */
export const PARSED_TEXT_MAX_BYTES = 80 * 1024;

/**
 * 单次 sendMessage 中所有「参与对话」的文件解析结果累计最大字节数。
 * 超过此值时按文件顺序累加，最后一个超限的文件被截断，并追加 `[因总大小限制已截断]` 标记。
 * 200KB ≈ 5 万汉字，足够覆盖大多数文档场景。
 */
export const INSTRUCTION_FILES_MAX_BYTES = 200 * 1024;

// ============================================================
// 7. 展示辅助常量
// ============================================================

/** 中文展示名，用于文件列表 / 错误提示 */
export const FILE_TYPE_LABELS: Record<FileType, string> = {
  word: 'Word 文档',
  excel: 'Excel 表格',
  ppt: 'PPT 演示',
  txt: '文本/Markdown',
  image: '图片',
};

/** 文件类型 emoji 图标，用于列表项 / 按钮 */
export const FILE_TYPE_ICONS: Record<FileType, string> = {
  word: '📄',
  excel: '📊',
  ppt: '📽️',
  txt: '📝',
  image: '🖼️',
};

/**
 * `<input type="file" accept="..." />` 用的扩展名字符串。
 * 拼接所有 FileType 的扩展名（去重、扁平化）。
 */
export const FILE_INPUT_ACCEPT: string = Array.from(
  new Set(Object.values(FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS).flat()),
).join(',');
