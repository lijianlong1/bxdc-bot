/**
 * 文档内容解析统一入口
 *
 * 根据 FileType 和文件扩展名自动路由到对应的前端解析器或 agent-core 兜底端点。
 * 各解析器（mammoth / SheetJS）通过动态 import() 按需延迟加载。
 *
 * 路由表：
 *   .docx       → parseDocx()    （mammoth，前端）
 *   .doc        → agentFallback()（旧格式，agent-core）
 *   .xlsx       → parseXlsx()    （SheetJS，前端）
 *   .xls        → agentFallback()（旧格式，agent-core）
 *   .ppt/.pptx  → agentFallback()（整体回退 agent-core）
 *   .txt/.md    → parseTxt()     （FileReader，零依赖）
 *
 * @module utils/fileParser
 */

import type { FileType } from '@/types/fileUpload'
import { agentUrl, apiUrl } from '@/services/config'

/** agent-core 兜底解析超时（毫秒） */
const AGENT_TIMEOUT_MS = 30_000

/**
 * 获取文件扩展名（小写，含点号）
 */
function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/**
 * 调用 agent-core 兜底解析端点
 *
 * 使用 FormData 上传文件到 POST /features/file/parse-document。
 * 该端点在任务 9 中实现；当前未就绪时返回友好错误提示。
 */
async function agentFallback(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(agentUrl('/features/file/parse-document'), {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('文档解析超时，请稍后重试')
    }
    // 网络错误或服务未启动
    throw new Error('文档解析服务暂不可用，请联系管理员')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error('文档解析服务暂不可用，请联系管理员')
  }

  const data = await response.json().catch(() => null)
  if (data && typeof data.text === 'string') {
    return data.text
  }

  throw new Error('文档解析服务返回格式异常')
}

/**
 * 调用 skill-gateway 图片 OCR 端点
 *
 * 使用 FormData 上传图片到 POST /api/file/ocr-image。
 * skill-gateway 内调用 DdsUtil.getOcrText() 完成识别。
 */
async function callImageOcr(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(apiUrl('/api/file/ocr-image'), {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('图片识别超时，请稍后重试')
    }
    throw new Error('文件解析服务暂不可用，请联系管理员')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error('文件解析服务暂不可用，请联系管理员')
  }

  const data = await response.json().catch(() => null)
  if (data && typeof data.text === 'string') {
    return data.text
  }

  throw new Error('文件解析服务返回格式异常')
}

/**
 * 解析文档文件，返回纯文本内容
 *
 * 根据文件扩展名和 FileType 自动选择解析器：
 * - 图片       → callImageOcr() （skill-gateway OCR）
 * - 新格式（.docx / .xlsx）前端处理（按需加载 mammoth / SheetJS）
 * - 旧格式（.doc / .xls）和 ppt 系列回退 agent-core
 * - .txt / .md 使用原生 FileReader 零依赖读取
 *
 * @param file - 浏览器 File 对象
 * @param fileType - 文件分类（来自 FILE_UPLOAD_CONFIG）
 * @param signal - 可选的 AbortSignal（仅对 TXT 分片读取有效）
 * @returns 解析后的纯文本字符串
 * @throws 解析失败或服务不可用时抛出含中文描述的 Error
 */
export async function parseDocument(
  file: File,
  fileType: FileType,
  signal?: AbortSignal,
): Promise<string> {
  const ext = getExt(file.name)

  // ── Word ──
  if (fileType === 'word') {
    if (ext === '.docx') {
      const { parseDocx } = await import('./docxParser')
      return parseDocx(file)
    }
    // .doc 旧格式 → agent-core
    return agentFallback(file)
  }

  // ── Excel ──
  if (fileType === 'excel') {
    if (ext === '.xlsx') {
      const { parseXlsx } = await import('./xlsxParser')
      return parseXlsx(file)
    }
    // .xls 旧格式 → agent-core
    return agentFallback(file)
  }

  // ── PPT ──
  if (fileType === 'ppt') {
    // ppt / pptx 均回退 agent-core（前端不引入 JSZip + XML 解析链）
    return agentFallback(file)
  }

  // ── TXT / MD ──
  if (fileType === 'txt') {
    const { parseTxt } = await import('./txtParser')
    return parseTxt(file, signal)
  }

  // ── 图片 OCR ──
  if (fileType === 'image') {
    return callImageOcr(file)
  }

  // 兜底：未知 fileType
  return agentFallback(file)
}
