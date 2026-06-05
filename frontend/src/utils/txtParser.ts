/**
 * TXT / MD 纯文本读取器
 *
 * 使用浏览器原生 FileReader API，零依赖。
 * 大文件自动分片读取，避免阻塞 UI 线程。
 *
 * @module utils/txtParser
 */

/** 分片大小：100KB */
const CHUNK_SIZE = 100 * 1024

/**
 * 读取 .txt / .md 文件的全部文本内容
 *
 * - 小文件（≤ 100KB）一次性读取
 * - 大文件按 100KB 分片读取，每片间 `await` 释放事件循环
 * - 支持 AbortSignal 取消读取
 *
 * @param file - 浏览器 File 对象
 * @param signal - 可选的 AbortSignal，触发时中断读取
 * @returns 文件文本内容
 * @throws 读取被取消时抛出 AbortError
 */
export function parseTxt(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size === 0) {
      resolve('')
      return
    }

    const reader = new FileReader()
    let result = ''
    let offset = 0

    const onAbort = () => {
      reader.abort()
      reject(new DOMException('文件读取已取消', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    const readNextChunk = () => {
      if (signal?.aborted) {
        reject(new DOMException('文件读取已取消', 'AbortError'))
        return
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE)
      reader.readAsText(chunk, 'UTF-8')
    }

    reader.onload = () => {
      result += reader.result as string
      offset += CHUNK_SIZE

      if (offset >= file.size) {
        signal?.removeEventListener('abort', onAbort)
        resolve(result)
      } else {
        // 释放事件循环，避免长时间阻塞 UI
        setTimeout(readNextChunk, 0)
      }
    }

    reader.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error(`文件读取失败：${file.name}`))
    }

    readNextChunk()
  })
}
