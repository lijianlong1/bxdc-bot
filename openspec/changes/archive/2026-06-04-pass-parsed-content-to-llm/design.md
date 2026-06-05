## Context

**当前状态**（任务 1-8 已完成）：
- `frontend/src/composables/useFileUpload.ts` 提供：
  - `uploadedFiles: Ref<{ word, excel, ppt, txt, image }>` 状态
  - `parseFileContent(file)` 异步解析单个文件，状态机 `pending → parsing → parsed | failed`
  - `getAllParsedText()` 同步拼接所有 `parsedText`
  - `clearFiles()` 清空状态
- `frontend/src/composables/useChat.ts` 任务 8 实现：
  - `sendMessage(content, userId?, attachedFiles?)` 第三参数接收 `UploadFileInfo[]`
  - instruction 拼接：`[用户消息]\n\n--- 文件：xxx ---\n<text>`
  - `/memory/add` 上报文件名清单
  - finally 块清空文件

**问题**：
1. **解析时序**：`parseFileContent` 是 fire-and-forget 的 Promise（`onFileChange` 触发解析但不等结果）。用户快速选择文件后立即点「发送」，可能部分文件还停留在 `parsing` 状态，导致 `parsedText` 为空，instruction 中这些文件被跳过。
2. **大文件膨胀**：5MB DOCX 解析后可能输出 200KB+ 纯文本，10 个文件拼到 instruction 会让请求体爆炸（DeepSeek 单次 token 上限限制）。
3. **失败可见性弱**：失败文件仍占 UI 位置，发送时静默跳过，用户不知情。
4. **图片/PPT 临时未实现**：任务 4-5 范围内，这两类文件 `parsedText` 永远为空，UI 显示「识别中...」但永远变 ✓。

**关键约束**：
- 保持 SSE 流式响应体验（不引入大延迟）
- 解析是大文件 IO 操作，UI 端不能无脑阻塞
- 不修改后端 agent-core 或 skill-gateway
- 复用现有 useFileUpload / useChat / MessageInput 边界

## Goals / Non-Goals

**Goals:**
- 解析完成的文件 `parsedText` 必传，**长度超阈值自动截断并提示**
- 解析中的文件提供「等待 / 立即发送」二选一交互（用户决策）
- 解析失败的文件**不参与** instruction 拼接，UI 明确「该文件未能解析，不参与本次对话」
- 整体行为对未传文件场景**完全兼容**（纯文本对话与原版一致）
- 单次 sendMessage 中所有「已参与」文件总大小仍有限制（如 200KB），超出按文件顺序截断并追加说明

**Non-Goals:**
- 不实现后端解析（任务 9-10 范围）
- 不实现图片 OCR / PPT 文本提取（任务 4-5 临时未实现，本次不补）
- 不修改 `/agent/run` 或 `/memory/add` 接口
- 不在 sendMessage 内部开启轮询等待（用 Promise 一次性 await）
- 不持久化「是否要等待」的用户偏好（每次重新询问）

## Decisions

### 1. 解析时序：使用 `await Promise.allSettled` + 超时

`parseFileContent` 已经是返回 Promise 的函数，useFileUpload 在 onFileChange 时已经 fire-and-forget 调用过。当 sendMessage 被调用时，**解析 Promise 已经存在（或已完成）**。

新增 `useFileUpload.waitForAllParsing(opts?: { timeoutMs?: number })`：
```ts
async waitForAllParsing({ timeoutMs = 5000 } = {}): Promise<{
  done: UploadFileInfo[]
  pending: UploadFileInfo[]
  failed: UploadFileInfo[]
}>
```
- 在 `Promise.race([allParsing, timeout])` 内等待
- 超时后立即返回当前状态（`done` / `pending` / `failed` 三分类）
- 默认 timeout 5 秒（防止用户上传超大文件时无限等待）

sendMessage 内部调用 `waitForAllParsing`，然后只把 `done` 拼到 instruction。`pending` 文件按用户选择处理（决策 2）。

### 2. 用户选择「等待 / 立即发送」

- MessageInput 检测到 `attachedFiles` 中有 `pending` 状态文件时，**弹出 t-popconfirm 提示**：
  > "N 个文件正在解析，是否等待解析完成后发送？"
  - 选「等待」→ 阻塞 handleSend，调用 `await waitForAllParsing()`，得到 `done` 列表后正常 sendMessage
  - 选「立即发送」→ 把 `pending` 文件改为 `status='skipped'`（新增状态）并直接 sendMessage（不参与 instruction）
  - 选「取消」→ 不发送
- 超时场景：5 秒后 Promise.race 触发，MessageInput 把超时未完成的文件标记为 `skipped`，弹 toast 提示「N 个文件解析超时，已跳过」

### 3. 长度截断

`frontend/src/types/fileUpload.ts` 新增常量：
```ts
export const PARSED_TEXT_MAX_BYTES = 80 * 1024  // 80KB
export const INSTRUCTION_FILES_MAX_BYTES = 200 * 1024  // 200KB
```

`getAllParsedText` 内部：
- 单文件超过 `PARSED_TEXT_MAX_BYTES` → 截断到 80KB，**追加 `... [内容已截断，原 X KB]`** 标记
- 所有文件总大小超过 `INSTRUCTION_FILES_MAX_BYTES` → 按文件顺序累加，最后一个文件截断，**追加 `... [因总大小限制已截断]`** 标记
- UI 在每个文件行展示「解析内容已截断」徽标

### 4. 失败文件不参与 + 明确提示

- `failed` 状态文件：在 `getAllParsedText` 内部 filter 掉
- MessageInput 在文件列表中给 `failed` 文件增加「该文件未能解析，不参与本次对话」tooltip
- sendMessage 完成后（finally 块）调用 `clearFiles()`，所有文件消失

### 5. 新增状态值 `skipped`

`UploadFileInfo.status` 类型扩展：`'pending' | 'parsing' | 'parsed' | 'failed' | 'skipped'`
- `skipped`：用户选择「立即发送」或解析超时，文件被跳过不参与本次对话
- 视觉表现：浅灰色 + 划线 + 「已跳过」文字
- 同样在 clearFiles 时被清空

### 6. 不修改 sendMessage SSE 流处理

- 拼接逻辑集中在 sendMessage 起始处（instruction 字段生成）
- SSE 响应处理保持原样
- `/memory/add` 调用保持原样（已 attachedFiles 全量上报文件名）
- finally 块保持原样（attachedFiles.length > 0 时 clearFiles）

## Risks / Trade-offs

- **风险**：waitForAllParsing 5s 超时可能太短，大 DOCX 解析慢的话用户看到 toast「已跳过」会困惑
  - **缓解**：t-popconfirm 选「等待」+ 进度条 spinner（基于 parsing 文件数）
  - 5s 是默认，可由 MessageInput 配置（tasks.md 暴露参数）
- **风险**：长度截断可能让大文件解析内容不完整，大模型只看到片段
  - **缓解**：在 instruction 截断处加 `... [原 250 KB 已截断到 80 KB，如需全文请分段上传]` 提示
  - 截断而非丢弃，保证仍能传部分内容
- **风险**：用户每次发有 `parsing` 状态文件都被问「等待 / 立即」，操作繁琐
  - **缓解**：可选优化（tasks.md 标记为「后续优化」）—— 持久化用户选择到 localStorage
- **权衡**：失败文件不参与 instruction 比「尝试发送空内容」更合理，因为空文本对 LLM 无意义
- **权衡**：本次不实现图片/PPT 解析，UI 仍显示这些文件但解析永远失败，视觉上略冗余
  - 可选优化：临时把图片/PPT 标记为「解析功能即将上线」而非 `failed`

## Open Questions

- 是否在 sendMessage 完成后把 `/memory/add` 上报改成只报「实际参与对话的文件名」？
  - 当前任务 8 实现是 attachedFiles 全量上报
  - 决策：**保持原行为**（用户主动选择上传即视为意图参与），但如果 waitForAllParsing 后才 sendMessage，attachedFiles 已经是「已选择参与」的列表
- 是否需要做「发送前预览 instruction 内容」UI？当前不做（会大幅复杂化 UI）
