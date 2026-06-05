/**
 * useFileUpload Composable
 *
 * 任务 3（add-file-upload-composable）产出物。
 * 集中管理文件上传状态、调用任务 2 校验工具、
 * 向上提供 addFiles/removeFile/clearFiles 等方法，
 * 向下为 useChat 暴露 getAllParsedText / getFileNamesForMemory。
 *
 * 解析占位：parseFileContent 当前仅做状态流转，
 * 实际解析由任务 4 (docxParser / xlsxParser / pptxParser) 和
 * 任务 5 (imageOcr) 实现后回填。
 *
 * @module composables/useFileUpload
 */

import { ref, provide, inject, type InjectionKey, type Ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { FileType, UploadFileInfo } from '../types/fileUpload'
import {
  PARSED_TEXT_MAX_BYTES,
  INSTRUCTION_FILES_MAX_BYTES,
} from '../types/fileUpload'
import {
  getFileTypeFromName,
  validateFile,
  validateTotalSize,
  validateFileCount,
} from '../utils/fileValidator'

// ============================================================
// 1. 类型与 InjectionKey
// ============================================================

/** 状态结构：5 个 FileType 分组的 UploadFileInfo 列表 */
export interface FileUploadState {
  uploadedFiles: Ref<Record<FileType, UploadFileInfo[]>>
  isUploading: Ref<boolean>
  uploadError: Ref<string | null>
  addFiles: (files: File[]) => Promise<void>
  removeFile: (fileId: string) => void
  clearFiles: () => void
  getAllParsedText: (files?: UploadFileInfo[]) => string
  getFileNamesForMemory: () => string[]
  parseFileContent: (file: UploadFileInfo) => Promise<string>
  /**
   * 等待所有处于 `parsing` 状态的文件完成解析，最多等待 `timeoutMs` 毫秒后返回当前状态。
   * 返回三分类：`done`（已 parsed 或 failed）、`pending`（仍 parsing）、`failed`。
   * 任务 pass-parsed-content-to-llm 引入。
   */
  waitForAllParsing: (opts?: { timeoutMs?: number }) => Promise<{
    done: UploadFileInfo[]
    pending: UploadFileInfo[]
    failed: UploadFileInfo[]
  }>
  /**
   * 外部更新文件状态（如把 parsing 文件标为 skipped）。
   * 任务 pass-parsed-content-to-llm 引入。
   */
  setFileStatus: (fileId: string, status: UploadFileInfo['status']) => void
}

const FileUploadKey: InjectionKey<FileUploadState> = Symbol('FileUploadKey')

/** 生成简短唯一 ID */
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** 初始化 5 个空分组 */
function emptyGroups(): Record<FileType, UploadFileInfo[]> {
  return {
    word: [],
    excel: [],
    ppt: [],
    txt: [],
    image: [],
  }
}

// ============================================================
// 2. provide / useFileUpload
// ============================================================

export function provideFileUpload(): FileUploadState {
  const uploadedFiles = ref<Record<FileType, UploadFileInfo[]>>(emptyGroups())
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  // ---- addFiles ----
  async function addFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return

    for (const file of files) {
      // 1. 通过扩展名识别 FileType（找不到则视为不支持）
      const fileType = getFileTypeFromName(file.name)
      if (!fileType) {
        MessagePlugin.error(`不支持的文件格式：${file.name}`)
        continue
      }

      // 2. 累计大小校验（基于同类型已有文件 + 当前文件）
      const existingOfType = uploadedFiles.value[fileType]
      const totalResult = validateTotalSize(existingOfType, file, fileType)
      if (!totalResult.valid) {
        for (const err of totalResult.errors) {
          MessagePlugin.error(err)
        }
        continue
      }

      // 3. 数量校验
      const countResult = validateFileCount(existingOfType, fileType)
      if (!countResult.valid) {
        for (const err of countResult.errors) {
          MessagePlugin.error(err)
        }
        continue
      }

      // 4. 组合校验（格式 / 大小 / 加密）
      const validation = await validateFile(file, existingOfType)
      if (!validation.valid) {
        for (const err of validation.errors) {
          MessagePlugin.error(err)
        }
        continue
      }

      // 5. 通过校验，构建 UploadFileInfo
      const info: UploadFileInfo = {
        id: genId(),
        file,
        fileName: file.name,
        fileType,
        size: file.size,
        status: 'pending',
        uploadedAt: Date.now(),
      }

      // image 类型额外生成预览 URL
      if (fileType === 'image') {
        info.previewUrl = URL.createObjectURL(file)
      }

      uploadedFiles.value[fileType].push(info)
    }
  }

  // ---- removeFile ----
  function removeFile(fileId: string): void {
    for (const fileType of Object.keys(uploadedFiles.value) as FileType[]) {
      const list = uploadedFiles.value[fileType]
      const removed = list.find((f) => f.id === fileId)
      if (removed) {
        if (removed.previewUrl) {
          URL.revokeObjectURL(removed.previewUrl)
        }
        const idx = list.indexOf(removed)
        list.splice(idx, 1)
        return
      }
    }
  }

  // ---- clearFiles ----
  function clearFiles(): void {
    for (const fileType of Object.keys(uploadedFiles.value) as FileType[]) {
      for (const f of uploadedFiles.value[fileType]) {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl)
        }
      }
    }
    uploadedFiles.value = emptyGroups()
    uploadError.value = null
  }

  // ---- getAllParsedText ----
  // 任务 pass-parsed-content-to-llm：增加单文件 / 总大小截断 + truncated 标记
  // 接受外部传入的 files 列表（避免在 sendMessage 内部调用 useFileUpload 时 inject 失败）
  function getAllParsedText(files?: UploadFileInfo[]): string {
    const source: UploadFileInfo[] = files
      ? files
      : (() => {
          const out: UploadFileInfo[] = []
          for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
            for (const f of uploadedFiles.value[ft]) out.push(f)
          }
          return out
        })()
    const parts: string[] = []
    let totalBytes = 0
    for (const f of source) {
        if (f.status !== 'parsed' || !f.parsedText) continue

        const encoder = new TextEncoder()
        const originalBytes = encoder.encode(f.parsedText).length
        const originalKB = Math.ceil(originalBytes / 1024)
        let text = f.parsedText
        let truncated = false

        // 单文件截断
        if (originalBytes > PARSED_TEXT_MAX_BYTES) {
          // 按字符数粗略截断（避免乱码），约 1.3 字符 / 字节
          const maxChars = Math.floor(PARSED_TEXT_MAX_BYTES / 1.3)
          text = text.slice(0, maxChars) + `\n... [内容已截断，原 ${originalKB} KB]`
          truncated = true
        }

        // 总大小截断（按 UTF-8 字节数计算当前累计）
        const currentBytes = encoder.encode(text).length
        if (totalBytes + currentBytes > INSTRUCTION_FILES_MAX_BYTES) {
          const remainingBytes = INSTRUCTION_FILES_MAX_BYTES - totalBytes
          if (remainingBytes <= 0) {
            // 配额已用完，文件整段截断为提示
            text = `... [因总大小限制已截断：${f.fileName} 内容未发送]`
            truncated = true
          } else {
            const maxChars = Math.floor(remainingBytes / 1.3)
            text = text.slice(0, maxChars) + `\n... [因总大小限制已截断]`
            truncated = true
          }
        }

        // 标记 truncated 状态（供 UI 徽标展示），仅在尚未设置时写入
        if (truncated && !f.truncated) {
          f.truncated = true
        }

        totalBytes += encoder.encode(text).length
        parts.push(`--- 文件：${f.fileName} ---\n${text}`)

        // 总配额已用完，后续文件不再追加（避免无意义拼接）
        if (totalBytes >= INSTRUCTION_FILES_MAX_BYTES) break
    }
    return parts.join('\n\n')
  }

  // ---- getFileNamesForMemory ----
  function getFileNamesForMemory(): string[] {
    const names: string[] = []
    for (const fileType of Object.keys(uploadedFiles.value) as FileType[]) {
      for (const f of uploadedFiles.value[fileType]) {
        names.push(f.fileName)
      }
    }
    return names
  }

  // ---- parseFileContent ----
  // 任务 4-5 接入 fileParser.parseDocument（docx/xlsx/txt 已实做；ppt/image 走 agent-core 兜底）
  async function parseFileContent(file: UploadFileInfo): Promise<string> {
    if (file.status === 'parsed') {
      return file.parsedText ?? ''
    }

    file.status = 'parsing'
    try {
      const { parseDocument } = await import('../utils/fileParser')
      const text = await parseDocument(file.file, file.fileType)
      file.parsedText = text
      file.status = 'parsed'
      return text
    } catch (err) {
      file.status = 'failed'
      file.errorMessage = err instanceof Error ? err.message : '解析失败'
      throw err
    }
  }

  // ---- waitForAllParsing ----
  // 任务 pass-parsed-content-to-llm：等待所有 parsing 状态文件完成（解析完成 / 失败 / 超时）
  function listAll(): UploadFileInfo[] {
    const out: UploadFileInfo[] = []
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      for (const f of uploadedFiles.value[ft]) out.push(f)
    }
    return out
  }
  async function waitForAllParsing(opts: { timeoutMs?: number } = {}): Promise<{
    done: UploadFileInfo[]
    pending: UploadFileInfo[]
    failed: UploadFileInfo[]
  }> {
    const timeoutMs = opts.timeoutMs ?? 5000
    const all = listAll()
    const parsing = all.filter((f) => f.status === 'parsing')
    if (parsing.length === 0) {
      return {
        done: all.filter((f) => f.status === 'parsed'),
        pending: [],
        failed: all.filter((f) => f.status === 'failed'),
      }
    }
    // 通过轮询方式等待所有 parsing 完成（5s 超时）
    const start = Date.now()
    const tick = 100
    return await new Promise((resolve) => {
      const check = () => {
        const cur = listAll()
        const stillParsing = cur.filter((f) => f.status === 'parsing')
        if (stillParsing.length === 0 || Date.now() - start >= timeoutMs) {
          resolve({
            done: cur.filter((f) => f.status === 'parsed'),
            pending: cur.filter((f) => f.status === 'parsing'),
            failed: cur.filter((f) => f.status === 'failed'),
          })
        } else {
          setTimeout(check, tick)
        }
      }
      check()
    })
  }

  // ---- setFileStatus ----
  // 任务 pass-parsed-content-to-llm：外部更新文件状态（如把 parsing 标为 skipped）
  function setFileStatus(fileId: string, status: UploadFileInfo['status']): void {
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      const target = uploadedFiles.value[ft].find((f) => f.id === fileId)
      if (target) {
        target.status = status
        return
      }
    }
  }

  const state: FileUploadState = {
    uploadedFiles: uploadedFiles,
    isUploading: isUploading,
    uploadError: uploadError,
    addFiles: addFiles,
    removeFile: removeFile,
    clearFiles: clearFiles,
    getAllParsedText: getAllParsedText,
    getFileNamesForMemory: getFileNamesForMemory,
    parseFileContent: parseFileContent,
    waitForAllParsing: waitForAllParsing,
    setFileStatus: setFileStatus,
  }
  provide(FileUploadKey, state)
  return state
}

export function useFileUpload(): FileUploadState {
  const provided = inject(FileUploadKey)
  if (provided) return provided

  // 降级：返回本地初始化的 state（单组件独立使用，不通过 provide 共享）
  const uploadedFiles = ref<Record<FileType, UploadFileInfo[]>>(emptyGroups())
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  async function addFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return
    for (const file of files) {
      const fileType = getFileTypeFromName(file.name)
      if (!fileType) {
        MessagePlugin.error(`不支持的文件格式：${file.name}`)
        continue
      }
      const validation = await validateFile(file, uploadedFiles.value[fileType])
      if (!validation.valid) {
        for (const err of validation.errors) MessagePlugin.error(err)
        continue
      }
      const info: UploadFileInfo = {
        id: genId(),
        file,
        fileName: file.name,
        fileType,
        size: file.size,
        status: 'pending',
        uploadedAt: Date.now(),
        previewUrl: fileType === 'image' ? URL.createObjectURL(file) : undefined,
      }
      uploadedFiles.value[fileType].push(info)
    }
  }

  function removeFile(fileId: string): void {
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      const list = uploadedFiles.value[ft]
      const removed = list.find((f) => f.id === fileId)
      if (removed) {
        if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
        const idx = list.indexOf(removed)
        list.splice(idx, 1)
        return
      }
    }
  }

  function clearFiles(): void {
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      for (const f of uploadedFiles.value[ft]) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      }
    }
    uploadedFiles.value = emptyGroups()
    uploadError.value = null
  }

  function getAllParsedText(files?: UploadFileInfo[]): string {
    const source: UploadFileInfo[] = files
      ? files
      : (() => {
          const out: UploadFileInfo[] = []
          for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
            for (const f of uploadedFiles.value[ft]) out.push(f)
          }
          return out
        })()
    const parts: string[] = []
    let totalBytes = 0
    for (const f of source) {
        if (f.status !== 'parsed' || !f.parsedText) continue

        const encoder = new TextEncoder()
        const originalBytes = encoder.encode(f.parsedText).length
        const originalKB = Math.ceil(originalBytes / 1024)
        let text = f.parsedText
        let truncated = false

        if (originalBytes > PARSED_TEXT_MAX_BYTES) {
          const maxChars = Math.floor(PARSED_TEXT_MAX_BYTES / 1.3)
          text = text.slice(0, maxChars) + `\n... [内容已截断，原 ${originalKB} KB]`
          truncated = true
        }

        const currentBytes = encoder.encode(text).length
        if (totalBytes + currentBytes > INSTRUCTION_FILES_MAX_BYTES) {
          const remainingBytes = INSTRUCTION_FILES_MAX_BYTES - totalBytes
          if (remainingBytes <= 0) {
            text = `... [因总大小限制已截断：${f.fileName} 内容未发送]`
            truncated = true
          } else {
            const maxChars = Math.floor(remainingBytes / 1.3)
            text = text.slice(0, maxChars) + `\n... [因总大小限制已截断]`
            truncated = true
          }
        }

        if (truncated && !f.truncated) f.truncated = true

        totalBytes += encoder.encode(text).length
        parts.push(`--- 文件：${f.fileName} ---\n${text}`)

        if (totalBytes >= INSTRUCTION_FILES_MAX_BYTES) break
    }
    return parts.join('\n\n')
  }

  function getFileNamesForMemory(): string[] {
    const names: string[] = []
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      for (const f of uploadedFiles.value[ft]) names.push(f.fileName)
    }
    return names
  }

  async function parseFileContent(file: UploadFileInfo): Promise<string> {
    if (file.status === 'parsed') return file.parsedText ?? ''
    file.status = 'parsing'
    try {
      const { parseDocument } = await import('../utils/fileParser')
      const text = await parseDocument(file.file, file.fileType)
      file.parsedText = text
      file.status = 'parsed'
      return text
    } catch (err) {
      file.status = 'failed'
      file.errorMessage = err instanceof Error ? err.message : '解析失败'
      throw err
    }
  }

  function listAll(): UploadFileInfo[] {
    const out: UploadFileInfo[] = []
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      for (const f of uploadedFiles.value[ft]) out.push(f)
    }
    return out
  }
  async function waitForAllParsing(opts: { timeoutMs?: number } = {}): Promise<{
    done: UploadFileInfo[]
    pending: UploadFileInfo[]
    failed: UploadFileInfo[]
  }> {
    const timeoutMs = opts.timeoutMs ?? 5000
    const all = listAll()
    const parsing = all.filter((f) => f.status === 'parsing')
    if (parsing.length === 0) {
      return {
        done: all.filter((f) => f.status === 'parsed'),
        pending: [],
        failed: all.filter((f) => f.status === 'failed'),
      }
    }
    const start = Date.now()
    const tick = 100
    return await new Promise((resolve) => {
      const check = () => {
        const cur = listAll()
        const stillParsing = cur.filter((f) => f.status === 'parsing')
        if (stillParsing.length === 0 || Date.now() - start >= timeoutMs) {
          resolve({
            done: cur.filter((f) => f.status === 'parsed'),
            pending: cur.filter((f) => f.status === 'parsing'),
            failed: cur.filter((f) => f.status === 'failed'),
          })
        } else {
          setTimeout(check, tick)
        }
      }
      check()
    })
  }

  function setFileStatus(fileId: string, status: UploadFileInfo['status']): void {
    for (const ft of Object.keys(uploadedFiles.value) as FileType[]) {
      const target = uploadedFiles.value[ft].find((f) => f.id === fileId)
      if (target) {
        target.status = status
        return
      }
    }
  }

  const state: FileUploadState = {
    uploadedFiles: uploadedFiles,
    isUploading: isUploading,
    uploadError: uploadError,
    addFiles: addFiles,
    removeFile: removeFile,
    clearFiles: clearFiles,
    getAllParsedText: getAllParsedText,
    getFileNamesForMemory: getFileNamesForMemory,
    parseFileContent: parseFileContent,
    waitForAllParsing: waitForAllParsing,
    setFileStatus: setFileStatus,
  }
  return state
}
