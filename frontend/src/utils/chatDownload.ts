import type { Message } from '../composables/useChat'
import { loadPdfLibs } from './vendorLoader'

/**
 * 获取当前时间戳字符串，用于文件名
 */
function timestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
}

/**
 * 将 ISO 时间戳转为可读格式
 */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 构建 Markdown 内容（单条消息）
 */
export function buildMarkdownContent(msg: Message): string {
  const lines: string[] = []
  lines.push('# BXDC.bot 对话记录')
  lines.push('')
  lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  const time = formatTime(msg.timestamp)
  const label = msg.role === 'user' ? '用户' : 'BXDC.bot'
  lines.push(`### ${label} (${time})`)
  lines.push('')
  lines.push(msg.content || '')
  lines.push('')

  return lines.join('\n')
}

/**
 * 下载 Markdown 文件（单条消息）
 */
export function downloadMarkdown(msg: Message): void {
  if (!msg || !msg.content) {
    return
  }
  const content = buildMarkdownContent(msg)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, `bxdc-chat-${timestamp()}.md`)
}

/**
 * 将消息内容转为安全的 HTML（转义特殊字符）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 构建 PDF 渲染用的 HTML 字符串（单条消息）
 */
function buildPdfHtml(msg: Message): string {
  const label = msg.role === 'user' ? '用户' : 'BXDC.bot'
  const time = formatTime(msg.timestamp)
  const body = escapeHtml(msg.content || '')
    .replace(/\n/g, '<br>')
  const roleColor = msg.role === 'user' ? '#2563eb' : '#059669'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
      padding: 30px;
      color: #1e293b;
    }
    .title { font-size: 26px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #64748b; margin-bottom: 16px; }
    .divider { height: 1px; background: #e2e8f0; margin-bottom: 20px; }
    .msg-block { margin-bottom: 16px; padding: 12px 16px; border-left: 4px solid ${roleColor}; background: #f8fafc; border-radius: 6px; }
    .msg-label { font-size: 15px; color: ${roleColor}; font-weight: 600; margin-bottom: 6px; }
    .msg-body { font-size: 16px; color: #1e293b; line-height: 1.8; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="title">BXDC.bot 对话记录</div>
  <div class="subtitle">导出时间：${escapeHtml(new Date().toLocaleString('zh-CN'))}</div>
  <div class="divider"></div>
  <div class="msg-block">
    <div class="msg-label">${escapeHtml(label)} · ${escapeHtml(time)}</div>
    <div class="msg-body">${body}</div>
  </div>
</body>
</html>`
}

/**
 * 下载 PDF 文件（离屏 iframe + 本地 vendor JS 渲染，无 npm 依赖）
 */
export async function downloadPdf(msg: Message): Promise<void> {
  if (!msg || !msg.content) {
    return
  }

  // 加载本地 vendor 脚本（jspdf + html2canvas），已加载过则跳过
  await loadPdfLibs()

  const { jsPDF } = (window as any).jspdf
  const html2canvas = (window as any).html2canvas

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const html = buildPdfHtml(msg)

  // 离屏 iframe：渲染在屏幕外，html2canvas 捕获，用户完全看不到
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:900px;height:1400px;border:none;'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument!
  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  // 等待 iframe 内浏览器完成布局 + 字体渲染
  await new Promise<void>(resolve => {
    const win = iframe.contentWindow!
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))
  })

  try {
    const body = iframeDoc.body
    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })

    const pageWidth = 210  // A4 宽度 mm
    const pageHeight = 297 // A4 高度 mm
    const pxPerMm = canvas.width / pageWidth
    let srcY = 0
    let page = 0

    while (srcY < canvas.height) {
      if (page > 0) doc.addPage()

      const sliceH = Math.min(pageHeight * pxPerMm, canvas.height - srcY)
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceH
      const ctx = sliceCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

      const sliceMmHeight = (sliceH * pageWidth) / canvas.width
      doc.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, sliceMmHeight)

      srcY += pageHeight * pxPerMm
      page++
    }

    doc.save(`bxdc-chat-${timestamp()}.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}

/**
 * 触发浏览器下载 Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
