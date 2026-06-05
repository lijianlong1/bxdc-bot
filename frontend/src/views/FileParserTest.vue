<script setup lang="ts">
import { ref } from 'vue'
import { parseDocument } from '../utils/fileParser'
import type { FileType } from '../types/fileUpload'

const status = ref<'idle' | 'parsing' | 'done' | 'error'>('idle')
const parsedText = ref('')
const errorMsg = ref('')
const fileName = ref('')
const fileType = ref<FileType>('word')

function getFileTypeFromName(name: string): FileType {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  if (['.doc', '.docx'].includes(ext)) return 'word'
  if (['.xls', '.xlsx'].includes(ext)) return 'excel'
  if (['.ppt', '.pptx'].includes(ext)) return 'ppt'
  if (['.txt', '.md'].includes(ext)) return 'txt'
  return 'txt'
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  fileType.value = getFileTypeFromName(file.name)
  status.value = 'parsing'
  parsedText.value = ''
  errorMsg.value = ''

  try {
    const text = await parseDocument(file, fileType.value)
    parsedText.value = text
    status.value = 'done'
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
    status.value = 'error'
  }
}

function copyResult() {
  navigator.clipboard.writeText(parsedText.value)
}
</script>

<template>
  <div class="test-page">
    <h2>文件解析测试</h2>

    <div class="upload-area">
      <label class="file-label" for="file-input">选择文件</label>
      <input
        id="file-input"
        type="file"
        accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
        @change="handleFileChange"
      />
      <span v-if="fileName" class="file-info">
        {{ fileName }}（{{ fileType }}）
      </span>
    </div>

    <div v-if="status === 'parsing'" class="status parsing">正在解析...</div>
    <div v-else-if="status === 'error'" class="status error">{{ errorMsg }}</div>

    <div v-if="parsedText && status === 'done'" class="result">
      <div class="result-header">
        解析结果（{{ parsedText.length }} 字）
        <button class="copy-btn" @click="copyResult">复制</button>
      </div>
      <pre class="result-text">{{ parsedText }}</pre>
    </div>
  </div>
</template>

<style scoped>
.test-page {
  max-width: 800px;
  margin: 40px auto;
  padding: 24px;
  font-family: sans-serif;
}

h2 {
  margin: 0 0 20px;
}

.upload-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.file-label {
  display: inline-block;
  padding: 8px 16px;
  background: #0052d9;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.file-label:hover {
  background: #0041b0;
}

input[type="file"] {
  display: none;
}

.file-info {
  font-size: 13px;
  color: #666;
}

.status {
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}
.status.parsing {
  background: #e8f0fe;
  color: #0052d9;
}
.status.error {
  background: #fde8e8;
  color: #c00;
}

.result {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f5f5f5;
  font-size: 13px;
  color: #333;
}

.copy-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  cursor: pointer;
}
.copy-btn:hover {
  background: #eee;
}

.result-text {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 500px;
  overflow-y: auto;
  background: #fafafa;
}
</style>
