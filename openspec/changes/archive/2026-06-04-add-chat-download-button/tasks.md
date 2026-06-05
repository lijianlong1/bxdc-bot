## 1. 依赖安装与工具函数

- [x] 1.1 安装 jspdf 依赖：`npm install jspdf`（frontend 目录）
- [x] 1.2 创建 `frontend/src/utils/chatDownload.ts`，实现以下函数：
  - `buildMarkdownContent(messages: Message[]): string` — 将对话数组转为 Markdown 字符串
  - `downloadMarkdown(messages: Message[]): void` — 构造 Blob 并触发 .md 下载
  - `downloadPdf(messages: Message[]): Promise<void>` — 使用 jspdf 生成 PDF 并触发下载

## 2. Markdown 导出功能

- [x] 2.1 实现 `buildMarkdownContent`：输出标题 "BXDC.bot 对话记录"、生成时间、每条消息的角色前缀与内容
- [x] 2.2 实现 `downloadMarkdown`：创建 Blob（type: text/markdown），通过 URL.createObjectURL + 隐藏 `<a>` 点击下载，文件名含时间戳
- [x] 2.3 空对话保护：对话为空时给出提示，不触发下载

## 3. PDF 导出功能

- [x] 3.1 实现 `downloadPdf`：使用 jspdf 创建 A4 文档，添加标题和时间，逐行输出对话内容
- [x] 3.2 处理 Markdown 到纯文本的转换（去除 `**`、``` 等标记，保留可读文本）
- [x] 3.3 动态 import jspdf（`import('jspdf')`），首次点击 PDF 时按需加载，减少初始打包体积
- [x] 3.4 空对话保护：对话为空时给出提示

## 4. UI 组件集成

- [x] 4.1 在 `MessageList.vue` 的 `<template #actions>` 插槽中，`TChatAction` 后添加下载按钮，使用 `t-dropdown` 包裹
- [x] 4.2 `t-dropdown` 下拉菜单包含两个 `t-dropdown-item`："Markdown (.md)" 和 "PDF (.pdf)"
- [x] 4.3 分别绑定 `@click` 事件，从 `useChat()` 获取 `messages`，调用对应的下载函数
- [x] 4.4 下载过程中按钮展示 loading 状态，完成后恢复
- [x] 4.5 确保下载按钮仅在 `item.role === 'assistant'` 且有对话内容时显示

## 5. 验证

- [x] 5.1 启动 frontend dev server，发送测试对话后点击 Markdown 下载，验证文件内容正确
- [x] 5.2 点击 PDF 下载，验证文件生成并包含对话内容
- [x] 5.3 验证空对话状态下不触发下载或给出提示
