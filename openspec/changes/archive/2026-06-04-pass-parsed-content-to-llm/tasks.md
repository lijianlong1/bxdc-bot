## 1. 类型与常量

- [x] 1.1 在 `frontend/src/types/fileUpload.ts` 新增常量
  - `PARSED_TEXT_MAX_BYTES = 80 * 1024`
  - `INSTRUCTION_FILES_MAX_BYTES = 200 * 1024`
- [x] 1.2 扩展 `UploadFileInfo.status` 类型为 `'pending' | 'parsing' | 'parsed' | 'failed' | 'skipped'`

## 2. useFileUpload 增强

- [x] 2.1 在 `frontend/src/composables/useFileUpload.ts` 新增 `waitForAllParsing({ timeoutMs = 5000 } = {})` 方法
  - 用 `Promise.race([allParsingPromises, timeoutPromise])` 实现
  - 返回 `{ done, pending, failed }` 三分类
- [x] 2.2 修改 `getAllParsedText()` 实现
  - 单文件超 `PARSED_TEXT_MAX_BYTES` 截断，追加 `[内容已截断，原 X KB]`
  - 总大小超 `INSTRUCTION_FILES_MAX_BYTES` 截断最后文件，追加 `[因总大小限制已截断]`
  - 跳过 `status !== 'parsed'` 的文件
- [x] 2.3 新增 `setFileStatus(id, status)` 方法支持外部更新状态（如 `skipped`）
- [x] 2.4 文件行级数据新增 `truncated: boolean` 标记（供 UI 展示截断徽标）

## 3. useChat.sendMessage 优化

- [x] 3.1 在 `frontend/src/composables/useChat.ts` 的 `sendMessage` 内部，调用 `/agent/run` 前**不修改**现有 instruction 拼接逻辑（任务 8 已实现）
- [x] 3.2 确认 `getAllParsedText` 返回的字符串包含截断标记
- [x] 3.3 `/memory/add` 上报逻辑保持原样（全量 attachedFiles）

## 4. MessageInput 交互

- [x] 4.1 在 `frontend/src/components/MessageInput.vue` 新增 `parsingConfirmVisible` 状态控制 t-popconfirm
- [x] 4.2 在 `handleSend` 入口处检测 `attachedFiles` 中是否有 `status === 'parsing'` 的文件
- [x] 4.3 若有，弹出 t-popconfirm：
  - 内容：「N 个文件正在解析，是否等待解析完成后发送？」
  - 选项：「等待解析」/「立即发送」/「取消」
- [x] 4.4 「等待解析」分支：
  - 显示 spinner（`isParsing` ref）
  - 调用 `await fileUpload.waitForAllParsing({ timeoutMs: 5000 })`
  - 正常调用 sendMessage
  - 把超时未完成文件通过 `setFileStatus(id, 'skipped')` 标记
  - 弹 toast「N 个文件解析超时，已跳过」
- [x] 4.5 「立即发送」分支：
  - 把所有 `status === 'parsing'` 文件标记为 `skipped`
  - 立即调用 sendMessage
- [x] 4.6 「取消」分支：不调用 sendMessage，输入框文本保留
- [x] 4.7 MessageInput 文件列表 UI 中给 `truncated` 文件增加「解析内容已截断」徽标
- [x] 4.8 MessageInput 文件列表 UI 中给 `failed` 文件增加「该文件未能解析，不参与本次对话」tooltip

## 5. 验证

- [x] 5.1 `npx vue-tsc --noEmit` 编译通过
- [x] 5.2 `npm run build` 成功
- [ ] 5.3 浏览器：纯文本对话（无文件）行为不变
- [ ] 5.4 浏览器：上传单个 .docx，等待 parsed 后发送，DevTools Network 面板查看 `/agent/run` 请求 body 中 `instruction` 包含文件段落
- [ ] 5.5 浏览器：上传多个 .docx，**部分仍 parsing** 时点发送，弹出 t-popconfirm
- [ ] 5.6 选「等待解析」：spinner 显示，解析完成后正常发送
- [ ] 5.7 选「立即发送」：parsing 文件被标记为 skipped（视觉灰色），不参与对话
- [ ] 5.8 选「取消」：不发送，输入框文本保留
- [ ] 5.9 上传超大 .docx（>80KB 解析结果）验证截断标记和 UI 徽标
- [ ] 5.10 上传不支持格式（如 .pdf）验证 `failed` 状态和 UI 提示
- [ ] 5.11 等待解析超时 5s 验证 toast 提示和 skipped 状态
- [ ] 5.12 发送完成后确认 `clearFiles` 生效（所有文件消失）
