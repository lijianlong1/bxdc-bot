## 1. useChat.sendMessage 签名扩展

- [x] 1.1 在 useChat.ts 顶部 import `useFileUpload` 和 `UploadFileInfo` type
- [x] 1.2 修改 `ChatState.sendMessage` 签名增加第三个参数 `attachedFiles?: UploadFileInfo[]`
- [x] 1.3 修改 `provideChat` 内部 `sendMessage` 函数签名同步扩展

## 2. instruction 拼接

- [x] 2.1 在 sendMessage 内部构建 `finalInstruction` 变量，初始为 `content`
- [x] 2.2 当 `attachedFiles` 非空时，遍历并拼接 `--- 文件：${f.fileName} ---\n${f.parsedText}` 段
- [x] 2.3 跳过 `parsedText` 为空的文件（filter）
- [x] 2.4 将 `finalInstruction` 替换原 fetch body 中的 `instruction` 字段

## 3. /memory/add 上报

- [x] 3.1 在 SSE 流 `done` 分支内、`activeSessionId.value = null` 之后、break 之前
- [x] 3.2 判断 `attachedFiles?.length > 0 && userId` 才执行
- [x] 3.3 用 `fetch(agentUrl('/memory/add'), { method: 'POST', ... })` 上报
- [x] 3.4 body 为 `{ userId, text: '本次对话涉及文件：' + fileNames.join('、'), role: 'system' }`
- [x] 3.5 用 `try-catch` 包裹，失败仅 `console.error` 不抛错

## 4. clearFiles 清理

- [x] 4.1 在 try-catch 外层加 `finally` 块
- [x] 4.2 在 `finally` 中判断 `attachedFiles?.length > 0` 时调用 `useFileUpload.clearFiles()`
- [x] 4.3 `provideChat` 顶部新增 `const fileUpload = useFileUpload()` 拿到 provide 的 fileUpload 引用

## 5. MessageInput 接入

- [x] 5.1 修改 `MessageInput.vue` 中 `handleSend` 函数
- [x] 5.2 当 `allFiles.value.length > 0` 时，调用 `sendMessage(text, currentUser.value?.id, allFiles.value)`
- [x] 5.3 移除 `// 任务 8 之前 sendMessage 不感知文件` 注释

## 6. 验证

- [x] 6.1 运行 `npx vue-tsc --noEmit` 确认编译通过
- [x] 6.2 浏览器进入 /chat，输入文本不传文件发送，行为与原版一致
- [x] 6.3 上传一个 .docx 文件（任务 4-5 完成后才能真正解析），确认发送时 instruction 包含文件段落
- [x] 6.4 上传文件后发送，确认网络面板中有 `POST /memory/add` 请求，body 包含 "本次对话涉及文件：xxx"
- [x] 6.5 发送完成后确认文件列表被清空（clearFiles 生效）
- [x] 6.6 不传文件时，确认不调用 `/memory/add`、不调用 `clearFiles`
