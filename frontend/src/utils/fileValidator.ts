/**
 * 文件校验工具
 *
 * 任务 2（add-file-validator）产出物。
 * 提供文件格式、大小、数量校验及加密文件检测。
 * 所有校验函数为纯函数，不依赖 Vue 响应式系统。
 *
 * @module utils/fileValidator
 */

import type { FileType, FileValidationResult, UploadFileInfo } from '../types/fileUpload'
import { FILE_UPLOAD_CONFIG, FILE_TYPE_LABELS } from '../types/fileUpload'

// ============================================================
// 1. 扩展名映射
// ============================================================

/**
 * 根据文件名扩展名映射到 FileType。
 * 遍历 FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS 反向查找，
 * 避免硬编码扩展名列表。
 */
export function getFileTypeFromName(fileName: string): FileType | null {
  const ext = '.' + fileName.split('.').pop()!.toLowerCase()
  const config = FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS

  for (const [fileType, exts] of Object.entries(config)) {
    if ((exts as string[]).includes(ext)) {
      return fileType as FileType
    }
  }
  return null
}

// ============================================================
// 2. 格式校验
// ============================================================

/**
 * 校验文件扩展名是否在允许列表中。
 */
export function validateFileExtension(file: File): FileValidationResult {
  const ext = '.' + file.name.split('.').pop()!.toLowerCase()
  const allExts = Object.values(FILE_UPLOAD_CONFIG.ACCEPTED_EXTENSIONS).flat()

  if (!allExts.includes(ext)) {
    return {
      valid: false,
      errors: ['不支持的文件格式：' + ext],
      warnings: [],
    }
  }
  return { valid: true, errors: [], warnings: [] }
}

// ============================================================
// 3. 大小与数量校验
// ============================================================

/** 格式化字节为 MiB（2 位小数） */
function formatMiB(bytes: number): string {
  const mib = bytes / (1024 * 1024)
  return mib.toFixed(2) + ' MiB'
}

/**
 * 校验单文件大小是否在限额内。
 */
export function validateFileSize(file: File, fileType: FileType): FileValidationResult {
  const maxSize = FILE_UPLOAD_CONFIG.MAX_SIZE_PER_FILE[fileType]
  if (file.size > maxSize) {
    const label = FILE_TYPE_LABELS[fileType]
    return {
      valid: false,
      errors: [
        `${label}文件大小超过上限（上限 ${formatMiB(maxSize)}，当前 ${formatMiB(file.size)}）`,
      ],
      warnings: [],
    }
  }
  return { valid: true, errors: [], warnings: [] }
}

/**
 * 校验同类型文件累计大小是否在限额内。
 * files 是当前已上传的同类型文件列表，不含当前新文件。
 * 调用方应在 addFiles 中先对同类型筛选再传入。
 */
export function validateTotalSize(
  existingFiles: UploadFileInfo[],
  newFile: File,
  fileType: FileType,
): FileValidationResult {
  const maxTotalSize = FILE_UPLOAD_CONFIG.MAX_TOTAL_SIZE[fileType]

  // txt 类型不限总大小
  if (maxTotalSize === Number.POSITIVE_INFINITY) {
    return { valid: true, errors: [], warnings: [] }
  }

  const existingTotal = existingFiles.reduce((sum, f) => sum + f.size, 0)
  const projectedTotal = existingTotal + newFile.size

  if (projectedTotal > maxTotalSize) {
    const label = FILE_TYPE_LABELS[fileType]
    return {
      valid: false,
      errors: [`${label}总大小超过上限（上限 ${formatMiB(maxTotalSize)}）`],
      warnings: [],
    }
  }
  return { valid: true, errors: [], warnings: [] }
}

/**
 * 校验同类型文件数量是否在限额内。
 * existingFiles 是当前已上传的同类型文件列表。
 */
export function validateFileCount(
  existingFiles: UploadFileInfo[],
  fileType: FileType,
): FileValidationResult {
  const maxCount = FILE_UPLOAD_CONFIG.MAX_COUNT[fileType]

  // txt 类型不限数量
  if (maxCount === Number.POSITIVE_INFINITY) {
    return { valid: true, errors: [], warnings: [] }
  }

  if (existingFiles.length >= maxCount) {
    const label = FILE_TYPE_LABELS[fileType]
    return {
      valid: false,
      errors: [`${label}数量超过上限（上限 ${maxCount} 个）`],
      warnings: [],
    }
  }
  return { valid: true, errors: [], warnings: [] }
}

// ============================================================
// 4. 加密文件检测
// ============================================================

/**
 * 读取文件头部字节（用于魔数检测）。
 */
function readFileHeader(file: File, bytes: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file.slice(0, bytes))
  })
}

/**
 * 检测文件是否加密。
 *
 * 当前覆盖：
 * - OLE 格式 (.doc/.xls/.ppt)：读取前 512 字节，查找 EncryptionInfo 流标记
 * - ZIP 格式 (.docx/.xlsx/.pptx)：不在此实现（TODO: 任务 4 解析时处理）
 *
 * 检测失败时静默降级返回 false，不阻塞上传流程。
 */
export async function isEncryptedFile(file: File): Promise<boolean> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext) return false

    // 仅检测 Office 旧格式 (.doc/.xls/.ppt) — OLE 复合文档
    if (['doc', 'xls', 'ppt'].includes(ext)) {
      const header = await readFileHeader(file, 512)
      const bytes = new Uint8Array(header)

      // OLE 文件魔数
      if (bytes[0] !== 0xd0 || bytes[1] !== 0xcf || bytes[2] !== 0x11 || bytes[3] !== 0xe0) {
        return false // 不是 OLE 文件
      }

      // 在 OLE header 中查找 "EncryptionInfo" 字符串
      const view = new DataView(header)
      for (let i = 0; i < bytes.length - 14; i++) {
        if (
          view.getUint8(i) === 0x45 &&    // E
          view.getUint8(i + 1) === 0x6e && // n
          view.getUint8(i + 2) === 0x63 && // c
          view.getUint8(i + 3) === 0x72 && // r
          view.getUint8(i + 4) === 0x79 && // y
          view.getUint8(i + 5) === 0x70 && // p
          view.getUint8(i + 6) === 0x74 && // t
          view.getUint8(i + 7) === 0x69 && // i
          view.getUint8(i + 8) === 0x6f && // o
          view.getUint8(i + 9) === 0x6e   // n
        ) {
          return true
        }
      }
      return false
    }

    // 新格式 (.docx/.xlsx/.pptx) — ZIP 格式，暂不在此实现加密检测
    // 任务 4 解析时若遇到加密文件会自然失败
    return false
  } catch {
    // 静默降级：检测失败不阻塞上传流程
    return false
  }
}

// ============================================================
// 5. 组合校验
// ============================================================

/**
 * 组合校验：依次执行格式校验 → 大小校验 → 加密检测。
 *
 * 注意：此函数不校验同类型累计大小和数量，
 * 累计校验由调用方（useFileUpload.addFiles）通过
 * `validateTotalSize` / `validateFileCount` 独立处理。
 */
export async function validateFile(
  file: File,
  _existingFiles: UploadFileInfo[],
): Promise<FileValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. 格式校验
  const extResult = validateFileExtension(file)
  if (!extResult.valid) {
    errors.push(...extResult.errors)
    return { valid: false, errors, warnings }
  }

  // 2. 大小校验（基于映射后的 FileType）
  const fileType = getFileTypeFromName(file.name)!
  const sizeResult = validateFileSize(file, fileType)
  if (!sizeResult.valid) {
    errors.push(...sizeResult.errors)
  }

  // 3. 加密检测
  const encrypted = await isEncryptedFile(file)
  if (encrypted) {
    errors.push('加密文件暂不支持上传，请解密后重试')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
