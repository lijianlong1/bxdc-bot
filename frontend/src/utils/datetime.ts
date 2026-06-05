/**
 * 时间解析工具。
 *
 * 后端统一按 UTC 序列化所有时间字段（pattern 末尾带 'Z' + timezone="UTC"）。
 * 前端解析时必须按"无时区 → 视为 UTC / 有 Z → 视为 UTC / 有偏移 → 用偏移"处理，
 * 然后用浏览器的本地时区显示。
 *
 * 解析失败返回 null，调用方应 fallback 到原字符串或留空。
 */

const ISO_UTC_SUFFIX = /^(.*?)(Z|[+-]\d{2}:?\d{2})?$/

/**
 * 把后端返回的时间字符串解析成 Date 对象。
 * - "2026-06-03T10:00:00"（无时区）→ 视为 UTC
 * - "2026-06-03T10:00:00Z"（带 Z）→ 视为 UTC
 * - "2026-06-03T10:00:00+08:00"（带偏移）→ 用偏移
 *
 * @param s 后端时间字符串
 * @returns 解析成功返回 Date，否则返回 null
 */
export function parseBackendTimeAsUtc(s: string | null | undefined): Date | null {
  if (!s) return null
  const trimmed = s.trim()
  if (!trimmed) return null

  // 标准 ISO 解析路径（带 Z 或偏移时最准）
  const m = trimmed.match(ISO_UTC_SUFFIX)
  if (!m) {
    // 完全没有时间形态
    return null
  }
  const hasZone = m[2] != null
  const isoCandidate = hasZone ? trimmed : `${trimmed}Z`

  const d = new Date(isoCandidate)
  if (isNaN(d.getTime())) {
    return null
  }
  return d
}

/**
 * 把后端时间格式化为"月/日 时:分"短字符串。
 * 解析失败返回空串（不返回原串，避免误导）。
 */
export function fmtShortTime(s: string | null | undefined): string {
  const d = parseBackendTimeAsUtc(s)
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 把后端时间格式化为"年-月-日 时:分:秒"完整字符串。
 * 解析失败返回原字符串（fallback，详情弹窗用）。
 */
export function fmtFullTime(s: string | null | undefined): string {
  const d = parseBackendTimeAsUtc(s)
  if (!d) return s || '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}
