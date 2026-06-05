import { describe, expect, it } from 'vitest'
import {
  getFileTypeFromName,
  validateFileExtension,
  validateFileSize,
  validateTotalSize,
  validateFileCount,
  validateFile,
  isEncryptedFile,
} from './fileValidator'
import { FILE_UPLOAD_CONFIG } from '../types/fileUpload'
import type { UploadFileInfo } from '../types/fileUpload'

// ============================================================
// 1. 工具函数：构造测试用 File / UploadFileInfo
// ============================================================

/** 构造一个 File 对象（指定文件名 + 字节数） */
function makeFile(name: string, sizeInBytes: number, content?: string): File {
  const blob = content !== undefined
    ? new Blob([content], { type: 'application/octet-stream' })
    : new Blob([new ArrayBuffer(sizeInBytes)], { type: 'application/octet-stream' })
  return new File([blob], name, { type: blob.type })
}

/** 构造一个 UploadFileInfo（用于 validateTotalSize / validateFileCount / validateFile） */
function makeInfo(name: string, sizeInBytes: number, type: UploadFileInfo['fileType']): UploadFileInfo {
  return {
    id: Math.random().toString(36).slice(2),
    file: makeFile(name, sizeInBytes),
    fileName: name,
    fileType: type,
    size: sizeInBytes,
    status: 'pending',
    uploadedAt: Date.now(),
  }
}

const MIB = 1024 * 1024

// ============================================================
// 2. getFileTypeFromName
// ============================================================

describe('getFileTypeFromName', () => {
  it('maps known extensions to FileType', () => {
    expect(getFileTypeFromName('a.docx')).toBe('word')
    expect(getFileTypeFromName('b.xlsx')).toBe('excel')
    expect(getFileTypeFromName('c.pptx')).toBe('ppt')
    expect(getFileTypeFromName('d.txt')).toBe('txt')
    expect(getFileTypeFromName('e.png')).toBe('image')
  })

  it('returns null for unknown extensions', () => {
    expect(getFileTypeFromName('video.mp4')).toBeNull()
    expect(getFileTypeFromName('archive.zip')).toBeNull()
    expect(getFileTypeFromName('doc.pdf')).toBeNull()
  })

  it('is case-insensitive for the extension', () => {
    expect(getFileTypeFromName('PHOTO.JPG')).toBe('image')
    expect(getFileTypeFromName('Photo.Jpeg')).toBe('image')
    expect(getFileTypeFromName('Docx.DOCX')).toBe('word')
  })

  it('handles filenames with multiple dots', () => {
    expect(getFileTypeFromName('2025.report.docx')).toBe('word')
    expect(getFileTypeFromName('my.image.backup.png')).toBe('image')
  })

  it('returns null for filenames without extension', () => {
    expect(getFileTypeFromName('README')).toBeNull()
  })
})

// ============================================================
// 3. validateFileExtension
// ============================================================

describe('validateFileExtension', () => {
  it('accepts all supported extensions', () => {
    expect(validateFileExtension(makeFile('a.docx', 1)).valid).toBe(true)
    expect(validateFileExtension(makeFile('a.xls', 1)).valid).toBe(true)
    expect(validateFileExtension(makeFile('a.pptx', 1)).valid).toBe(true)
    expect(validateFileExtension(makeFile('a.md', 1)).valid).toBe(true)
    expect(validateFileExtension(makeFile('a.webp', 1)).valid).toBe(true)
  })

  it('rejects unsupported extensions with descriptive error', () => {
    const r = validateFileExtension(makeFile('video.mp4', 1))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/不支持的文件格式/)
    expect(r.errors[0]).toContain('.mp4')
  })
})

// ============================================================
// 4. validateFileSize
// ============================================================

describe('validateFileSize', () => {
  it('passes when size is within limit', () => {
    const r = validateFileSize(makeFile('a.docx', 3 * MIB), 'word')
    expect(r.valid).toBe(true)
  })

  it('passes when size equals the limit exactly', () => {
    const limit = FILE_UPLOAD_CONFIG.MAX_SIZE_PER_FILE.word
    const r = validateFileSize(makeFile('a.docx', limit), 'word')
    expect(r.valid).toBe(true)
  })

  it('rejects files exceeding the limit', () => {
    const r = validateFileSize(makeFile('a.xlsx', 2 * MIB), 'excel')
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/文件大小超过上限/)
  })

  it('uses Chinese label in the error message', () => {
    const r = validateFileSize(makeFile('a.pptx', 100 * MIB), 'ppt')
    expect(r.errors[0]).toMatch(/PPT 演示/)
  })
})

// ============================================================
// 5. validateTotalSize
// ============================================================

describe('validateTotalSize', () => {
  it('passes when projected total is within limit', () => {
    const existing = [makeInfo('a.png', 10 * MIB, 'image'), makeInfo('b.png', 10 * MIB, 'image')]
    const newFile = makeFile('c.png', 5 * MIB)
    const r = validateTotalSize(existing, newFile, 'image')
    expect(r.valid).toBe(true)
  })

  it('rejects when projected total exceeds limit', () => {
    const existing = [makeInfo('a.png', 28 * MIB, 'image')]
    const newFile = makeFile('b.png', 5 * MIB)
    const r = validateTotalSize(existing, newFile, 'image')
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/总大小超过上限/)
  })

  it('skips check for txt (Infinity)', () => {
    const existing = Array.from({ length: 100 }, (_, i) => makeInfo(`${i}.txt`, MIB, 'txt'))
    const newFile = makeFile('new.txt', 100 * MIB)
    const r = validateTotalSize(existing, newFile, 'txt')
    expect(r.valid).toBe(true)
  })
})

// ============================================================
// 6. validateFileCount
// ============================================================

describe('validateFileCount', () => {
  it('passes when below limit', () => {
    const existing = [makeInfo('a.docx', MIB, 'word'), makeInfo('b.docx', MIB, 'word')]
    const r = validateFileCount(existing, 'word')
    expect(r.valid).toBe(true)
  })

  it('rejects when at limit (about to exceed)', () => {
    const existing = [makeInfo('a.docx', MIB, 'word'), makeInfo('b.docx', MIB, 'word'), makeInfo('c.docx', MIB, 'word')]
    const r = validateFileCount(existing, 'word')
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/Word 文档数量超过上限（上限 3 个）/)
  })

  it('skips check for txt (Infinity)', () => {
    const existing = Array.from({ length: 1000 }, (_, i) => makeInfo(`${i}.txt`, MIB, 'txt'))
    const r = validateFileCount(existing, 'txt')
    expect(r.valid).toBe(true)
  })
})

// ============================================================
// 7. validateFile (组合校验)
// ============================================================

describe('validateFile (combined)', () => {
  it('passes a valid file with empty existing list', async () => {
    const r = await validateFile(makeFile('a.docx', MIB), [])
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('short-circuits on unsupported extension', async () => {
    const r = await validateFile(makeFile('a.mp4', 10 * MIB), [])
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/不支持的文件格式/)
  })

  it('catches size violation when extension is valid', async () => {
    const r = await validateFile(makeFile('a.xlsx', 5 * MIB), [])
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/文件大小超过上限/)
  })

  it('ignores existing files for non-overlapping checks', async () => {
    // existing 列表中即使有 word 文件，本次新加一个 txt 也只需校验 txt 自身
    const existing = [makeInfo('a.docx', MIB, 'word')]
    const r = await validateFile(makeFile('b.txt', 0.1 * MIB), existing)
    expect(r.valid).toBe(true)
  })
})

// ============================================================
// 8. isEncryptedFile
// ============================================================

describe('isEncryptedFile', () => {
  it('returns false for plain text files', async () => {
    const f = makeFile('a.txt', 100, 'hello world this is plain text content')
    expect(await isEncryptedFile(f)).toBe(false)
  })

  it('returns false for non-OLE files with .doc extension', async () => {
    // 没有 OLE 魔数 (D0 CF 11 E0) 的伪 .doc 文件
    const content = 'not a real OLE file, just plain text'
    const f = makeFile('a.doc', content.length, content)
    expect(await isEncryptedFile(f)).toBe(false)
  })

  it('returns false for files with non-Office extensions', async () => {
    expect(await isEncryptedFile(makeFile('a.png', 1024))).toBe(false)
    expect(await isEncryptedFile(makeFile('a.jpg', 1024))).toBe(false)
  })
})
