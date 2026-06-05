/**
 * 动态加载外部 JS 脚本（带缓存，避免重复加载）
 */
function loadScript(src: string): Promise<void> {
  const id = `__vendor_${btoa(src).replace(/[+/=]/g, '')}`
  if (document.getElementById(id)) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * 加载 jspdf 和 html2canvas 的本地 vendor 脚本
 */
export async function loadPdfLibs(): Promise<void> {
  await loadScript('/vendor/jspdf.umd.min.js')
  await loadScript('/vendor/html2canvas.min.js')
}
