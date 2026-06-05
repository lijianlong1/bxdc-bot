## Context

文件上传功能任务 8：useChat 消息发送时整合文件内容与状态清理。

**当前状态**：
- `frontend/src/composables/useChat.ts` 中 `sendMessage(content, userId?)` 仅发送纯文本
- `frontend/src/composables/useFileUpload.ts` 已实现 `getAllParsedText()` / `getFileNamesForMemory()` / `clearFiles()`
- `frontend/src/components/MessageInput.vue` 中 `handleSend` 调用 `sendMessage(text, currentUser.value?.id)`，注释写明"任务 8 之前 sendMessage 不感知文件"
- `backend/agent-core/src/controller/memory.controller.ts` 已暴露 `POST /memory/add` 端点（接收 `{ userId, text, role }`）

**关键约束**（来自任务 8 文档）：
- 文件解析内容要拼到发送给大模型的 message 中
- `/memory/add` 只传文件名清单，不传文件内容
- sendMessage 完成后清空文件状态

## Goals / Non-Goals

**Goals:**
- `sendMessage(content, userId?, attachedFiles?)` 第三个参数接收 `UploadFileInfo[]`
- 若有 attachedFiles，将每个文件 `parsedText` 按 `--- 文件：filename ---\n<text>` 格式拼到 instruction
- 流式响应结束后，若有 attachedFiles 且有 userId，调用 `/memory/add` 上传文件名清单
- sendMessage 完成后（含成功 / 失败 / 异常）调用 `clearFiles()` 清空文件
- MessageInput 调用 sendMessage 时传入当前已选文件列表
- 不影响纯文本消息发送行为（attachedFiles 缺省时与之前完全一致）

**Non-Goals:**
- 不修改 SSE 流处理逻辑
- 不在 sendMessage 内部维护文件状态（继续由 useFileUpload 负责）
- 不修改 /memory/add 端点
- 不修改 useFileUpload 的 `clearFiles` / `getAllParsedText` 实现
- 不实现异步文件解析等待（任务 4-5 范围）

## Decisions

1. **`attachedFiles` 作为可选参数而非从 useFileUpload 直接拉取**
   - useChat 与 useFileUpload 是平级 composable，useChat 不依赖 useFileUpload
   - 由调用方（MessageInput）负责把 useFileUpload 的文件列表传给 sendMessage，职责清晰
   - 保持 useChat 的可测试性（不强制依赖 useFileUpload）

2. **instruction 拼接格式**
   ```
   [用户消息文本]

   --- 文件：report.docx ---
   <文件解析文字内容>
   --- 文件：data.xlsx ---
   <文件解析文字内容>
   ```
   - 用 `\n\n` 分隔用户文本与文件内容
   - 每个文件用 `--- 文件：xxx ---\n<text>` 分隔（与 `getAllParsedText` 内部格式一致）
   - 若某个文件 `parsedText` 为空（解析未完成），跳过该文件，不污染 instruction

3. **`/memory/add` 调用的位置**
   - 在流式响应正常完成（`done` 分支）后调用
   - 失败 / 异常路径不调用（避免错误状态下上报错误信息）
   - `userId` 缺失时不调用（无用户身份时无法上报记忆）

4. **`/memory/add` 调用方式**
   - 使用 `fetch(agentUrl('/memory/add'), { method: 'POST', ... })`，与已有 `/agent/run` 调用风格一致
   - 失败用 `console.error` 记录，不抛错（记忆上报失败不影响主流程）
   - 不阻塞 sendMessage 后续清理

5. **`clearFiles()` 调用位置**
   - 在 `finally` 块中调用（任务 8.4 "sendMessage 调用完成后清除文件状态"）
   - 无论成功 / 失败 / 异常，文件状态都会被清空
   - 但要等所有上传完成（即 attachedFiles 已被消费）后再清

6. **不在 sendMessage 内部等待文件解析**
   - 当前 `parseFileContent` 是占位（任务 4-5 未完成）
   - 若 attachedFiles 中有 `status !== 'parsed'` 的文件，`parsedText` 可能为空
   - 这些文件仍会被拼到 instruction（但文本为空），不会阻塞主流程
   - 文件名仍会进入 `/memory/add` 上报

## Risks / Trade-offs

- [Risk] `clearFiles()` 在 finally 块调用，如果用户上传了文件但还没解析完，文件会被立即清空 → 缓解：用户每次发送是主动行为，"发送即清空"是符合预期的；解析未完成的文件不展示在 UI 中（`status === 'parsing'`），不会有残影
- [Risk] `/memory/add` 失败时静默忽略（仅 console.error）→ 缓解：避免记忆上报失败阻塞主流程；如有需要可后续在 UI 中提示
- [Trade-off] 解析未完成的文件也参与 `/memory/add` 上报 → 当前任务 4-5 未实现，全是占位；任务 4-5 完成后此问题自然解决

## Open Questions

- 是否需要把 attachedFiles 中的 `parsedText` 长度限制在某个阈值内（如 100KB），避免 instruction 过大？当前任务范围不涉及，留待后续优化。
