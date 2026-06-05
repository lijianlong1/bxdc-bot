## Why

用户与 BXDC.bot 对话后需要保存对话结果用于记录、分享或离线查阅。当前聊天界面每条 assistant 消息只提供了复制按钮，缺少将完整对话导出为文件的途径。

## What Changes

- 在聊天消息的 actions 区域（TChatAction 的 #actions 插槽，现有复制按钮旁边）增加一个下载按钮
- 点击下载按钮弹出格式选择（Markdown / PDF）
- Markdown 导出：将当前会话的全部对话转为格式化的 .md 文件并触发浏览器下载
- PDF 导出：将对话内容渲染为 .pdf 文件并触发浏览器下载
- 下载内容包含欢迎语及所有用户与 assistant 的对话轮次

## Capabilities

### New Capabilities
- `chat-download`: 聊天对话导出下载功能，支持将完整会话导出为 Markdown 或 PDF 格式文件

### Modified Capabilities
<!-- No existing spec requirements change -->

## Impact

- **前端**: `MessageList.vue` 的 `#actions` 模板插槽新增下载按钮与格式选择逻辑；新增 `useChatDownload` composable 或工具函数处理 Markdown/PDF 生成；需引入 PDF 生成依赖（如 jspdf 或 html2pdf）
- **依赖新增**: jspdf（PDF 生成，纯前端，无需后端支持）
- **不影响后端**: 全部导出逻辑在浏览器端完成
