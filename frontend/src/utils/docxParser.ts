/**
 * DOCX 文档纯文本提取器
 *
 * 使用 mammoth 库将 .docx 文件转换为纯文本字符串。
 * 所有 XML 标签、样式、元数据均被剥离，仅保留可读文本。
 *
 * @module utils/docxParser
 */

import '../lib/mammoth.browser.js'

// ── 类型声明（mammoth 通过 IIFE 挂载到 window，无 ESM 导出） ──

declare global {
  interface Window {
    mammoth: {
      extractRawText(input: {
        arrayBuffer: ArrayBuffer
      }): Promise<{ value: string; messages: unknown[] }>
    }
  }
}

/**
 * 从 .docx 文件中提取纯文本内容
 *
 * @param file - 浏览器 File 对象（扩展名应为 .docx）
 * @returns 解析后的纯文本字符串；0 字节文件返回空字符串
 * @throws 文件格式损坏或无法解析时抛出含中文描述的 Error
 */
export async function parseDocx(file: File): Promise<string> {
  if (file.size === 0) {
    return ''
  }

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch {
    throw new Error(`Word 文档读取失败：${file.name}`)
  }

  try {
    const result = await window.mammoth.extractRawText({ arrayBuffer })
    return result.value
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`Word 文档解析失败：${file.name}（${detail}）`)
  }
}
