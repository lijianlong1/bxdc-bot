/**
 * XLSX 表格纯文本提取器
 *
 * 使用 SheetJS（xlsx 社区版）将 .xlsx 文件各 sheet 转为 CSV 文本并拼接。
 *
 * @module utils/xlsxParser
 */

import '../lib/xlsx.js'

// ── 类型声明（SheetJS 通过 CommonJS/window 导出，无 ESM 导出） ──

interface WorkBook {
  SheetNames: string[]
  Sheets: Record<string, WorkSheet>
}

interface WorkSheet {
  [key: string]: unknown
}

declare global {
  interface Window {
    XLSX: {
      read(data: Uint8Array, opts: { type: 'array' }): WorkBook
      utils: {
        sheet_to_csv(sheet: WorkSheet, opts?: { FS?: string; blankrows?: boolean }): string
      }
    }
  }
}

/**
 * 从 .xlsx 文件中提取所有 sheet 的文本内容
 *
 * 每个 sheet 以 `--- Sheet: {name} ---` 为标题，
 * 内容为 CSV 格式，sheet 之间以空行分隔。
 *
 * @param file - 浏览器 File 对象（扩展名应为 .xlsx）
 * @returns 拼接后的文本字符串
 * @throws 文件格式损坏或无法解析时抛出含中文描述的 Error
 */
export async function parseXlsx(file: File): Promise<string> {
  if (file.size === 0) {
    return ''
  }

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch {
    throw new Error(`Excel 文件读取失败：${file.name}`)
  }

  let workbook: WorkBook
  try {
    workbook = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`Excel 文件解析失败：${file.name}（${detail}）`)
  }

  const sheets: string[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const csv = window.XLSX.utils.sheet_to_csv(sheet, { FS: ',', blankrows: false })
    sheets.push(`--- Sheet: ${name} ---\n${csv}`)
  }

  return sheets.join('\n\n')
}
