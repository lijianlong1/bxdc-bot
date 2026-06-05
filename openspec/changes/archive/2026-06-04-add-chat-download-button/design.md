## Context

当前聊天界面通过 TDesign Chat 组件展示对话，每条 assistant 消息的 `#actions` 插槽中仅包含 `TChatAction` 的复制按钮。用户需要将对话导出为文件以便保存和分享。本项目前端为 Vue 3 + TDesign Vue Next + TypeScript + Vite。

## Goals / Non-Goals

**Goals:**
- 在 assistant 消息 actions 区域增加下载按钮，与现有复制按钮并排
- 点击后弹出下拉菜单选择 Markdown 或 PDF 格式
- MD 导出：纯前端拼接字符串生成 .md 文件，通过 Blob 下载
- PDF 导出：使用 jspdf 库在浏览器端生成 PDF 并触发下载
- 导出内容覆盖完整会话（欢迎语 + 所有用户/assistant 消息）

**Non-Goals:**
- 不涉及后端 API 变更
- 不支持导出选中部分消息（导出全部或单条）
- 不支持其他格式如 HTML、TXT

## Decisions

### 1. PDF 生成库选择：jspdf

**选择**: `jspdf` (约 200KB gzipped)
**替代方案**: 
- `html2pdf.js` (基于 html2canvas + jspdf，体积更大，渲染依赖 DOM)
- `pdfmake` (声明式，但对中文支持需要额外配置字体)

**理由**: jspdf 轻量、纯 JS 无 DOM 依赖、通过 `doc.text()` 逐行排版即可。配合简单的 Markdown 到纯文本的转换逻辑，可控性强。

### 2. 下载按钮放在 #actions 插槽

**选择**: 在 `MessageList.vue` 现有的 `<template #actions>` 插槽中，`TChatAction` 之后添加自定义下载按钮

**理由**: TDesign TChatAction 的 `operation-btn` 仅支持内置操作（copy/good/bad/replay/share），不支持自定义下载操作。使用自定义按钮放在同一插槽内，视觉上与复制按钮并排，是最小改动方式。

### 3. 对话数据获取方式

**选择**: 通过 `useChat()` composable 获取 `messages` 响应式数组，直接在组件内读取

**理由**: `messages` 已包含完整的对话历史，无需额外 API 请求。`useChat()` 已通过 `provideChat()` 在 `ChatView` 层级 provide，`MessageList` 可直接 inject。

### 4. 格式选择交互

**选择**: 使用 TDesign `t-dropdown` 组件，点击下载按钮弹出下拉菜单，包含 "Markdown (.md)" 和 "PDF (.pdf)" 选项

**理由**: TDesign 原生组件，样式一致，交互无额外学习成本。

### 5. Markdown 文件生成

**选择**: 纯字符串拼接，构建完整 Markdown 文本后通过 Blob + URL.createObjectURL 触发下载

**理由**: 零依赖，逻辑简单直接。

### 6. PDF 文件生成

**选择**: 使用 jspdf 的 `doc.text()` 逐行输出，中文使用内置字体（默认支持 CJK 在部分浏览器可能缺失字形，jspdf 的默认字体支持基本 Latin 字符；中文内容需依赖系统字体或嵌入字体）。

**降级策略**: 由于 jspdf 默认 Helvetica 字体不支持中文，实际实现中优先使用 Markdown 导出（零依赖、完美支持中文）。PDF 方案可预留为后续增强（需嵌入中文字体 base64，体积较大）。

**建议**: 初版侧重 Markdown 导出质量；PDF 使用 jspdf 生成但中文显示为 Unicode 占位提示用户使用 Markdown 格式查看完整内容。后续可通过字体嵌入解决。

## Risks / Trade-offs

- **[Risk] jspdf 默认字体不支持中文** → 初版 PDF 中文可能显示异常；Markdown 导出作为主要格式，PDF 作为辅助格式并在按钮上标注
- **[Risk] 大段对话导致 PDF 分页复杂** → 使用 jspdf 的 `autoTable` 或手动分页逻辑；初版可暂不支持长对话分页优化
- **[Trade-off] 构建体积增加** → jspdf 约增加 200KB gzipped，可通过动态 import 按需加载（用户点击 PDF 下载时才加载库）
