## Why

文件上传功能任务 8 已实现 useChat 消息发送时整合文件内容：把 `parsedText` 拼到 `/agent/run` 的 `instruction` 字段，让大模型在调用时能看到附件内容。但目前前端任务 4-5（文档解析器）只对 .docx/.xlsx/.txt/.md 提供临时解析，且仅在 `parseFileContent` 触发后填充 `parsedText`。

当前**已有**的能力：
- 任务 1-3、6-8：前端文件上传 + useFileUpload 状态管理 + 解析结果在 `parsedText` 字段
- 任务 4-5：mammoth/xlsx 浏览器端解析
- 后端：DeepSeek LLM 调用 + agent-core 持久化 + skill-gateway

**缺失的能力**：
- sendMessage 时若大文件解析慢，附件内容尚未填充就已发送 → 大模型拿不到完整内容
- 没有提示用户「文件正在解析，是否等待」的交互
- 图片/PPT 临时未做 OCR/解析，前端 sendMessage 时 `parsedText` 为空直接被跳过
- 用户切换到无文件状态后，UI 状态没有明确反馈

## What Changes

- 优化 useChat 消息发送流程
  - **不阻塞**主流程（保持原流式响应速度）
  - 解析完成的文件 `parsedText` 拼接到 instruction 立即发送
  - 解析中的文件 (`status === 'parsing'`)：**可选项**——是否等待解析完成后再发送（由用户决定）
  - 解析失败的文件 (`status === 'failed'`)：**不参与** instruction 拼接，UI 给出明确提示
- 增加 `parsedText` 长度限制 + 截断提示
  - 单个文件解析结果超过阈值（如 80KB）时截断，避免 instruction 过大
  - UI 展示「解析内容已截断（X KB / Y KB）」
- 增加发送前解析等待交互（可选，Task B）
  - MessageInput 检测到有 `parsing` 状态文件时，显示「有 N 个文件正在解析，是否等待？」提示
  - 用户选择「等待」：阻塞发送直到所有文件解析完成
  - 用户选择「立即发送」：跳过未完成文件
- 失败文件处理
  - 解析失败的文件在 input-box 中保持可见，但发送时排除
  - 状态从 `failed` 改为「未参与」并附 tooltip 说明

## Capabilities

### New Capabilities
- `pass-parsed-content-to-llm`: useChat 消息发送时正确处理文件解析状态（parsing / parsed / failed）并将已解析内容传递给大模型

### Modified Capabilities
- `usechat-message-file-integration`：扩展 REQUIREMENTS（解析状态处理、长度截断、等待交互）

## Impact

- 修改文件：
  - `frontend/src/composables/useChat.ts`（sendMessage 内部拼接逻辑）
  - `frontend/src/components/MessageInput.vue`（UI 提示 + handleSend 重构）
  - `frontend/src/composables/useFileUpload.ts`（可能新增 `waitForAllParsed` Promise 工具方法）
  - `frontend/src/types/fileUpload.ts`（可能新增 `PARSED_TEXT_MAX_BYTES` 常量）
- 依赖：
  - 现有 `useFileUpload.parseFileContent` / `getAllParsedText`（任务 4-5 已存在）
  - 现有 `sendMessage(content, userId, attachedFiles)` 签名（任务 8 已存在）
- 不影响纯文本消息发送（attachedFiles 缺省时与原行为一致）
- 不修改后端 /agent/run / /memory/add 接口
- 不新增 npm 依赖
