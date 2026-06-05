## 1. Agent 提示词

- [ ] 1.1 在 `backend/agent-core` 中定位 ReAct Agent / `ChatOpenAI` 创建处（如 `agent.ts` 或既有 `AGENT_*_POLICY` 拼接点），新增常量段落 `TOOL_CALLING_POLICY`：要求优先使用 API 原生 tool/function calling；文本回退时使用 `<tool_call>...</tool_call>` 包裹 JSON，并约定字段（如 `name`、`arguments`）
- [ ] 1.2 将该段落并入系统提示或全局指令，确保不与现有记忆/Skill/任务策略互斥（可追加在末尾）
- [ ] 1.3 如需可配置化，可留环境变量开关控制是否注入该段（可选，默认注入）

## 2. 前端开关与持久化

- [ ] 2.1 在聊天界面（如 `MessageList.vue` 工具条或 `ChatView` 设置区）增加 Switch，标签与说明文案清晰（例如「从正文 &lt;tool_call&gt; 解析工具（兼容弱模型）」）
- [ ] 2.2 使用 `localStorage`（或项目已有偏好存储）持久化键值，默认 `false`

## 3. 正文解析与合并逻辑

- [ ] 3.1 新增工具函数模块（如 `frontend/src/utils/parseToolCallsFromXml.ts`）：从字符串中提取所有 `<tool_call>...</tool_call>`，解析 JSON，校验 `name`；`arguments` 支持 object 或 JSON 字符串；多段返回数组
- [ ] 3.2 在 `useChat.ts` 的 `extractToolInvocationsFromChunk`（或统一入口）中：读取开关；若关闭则保持现状；若开启且 `getToolCallEntries` 为空，则从 assistant 消息的文本内容调用 3.1，映射为 `ToolInvocation[]`（`id`/`name`/`arguments`/初始 `running` 状态与现有字段一致）
- [ ] 3.3 实现「结构化非空则优先、不重复合并」策略；对解析失败做 try/catch，不阻塞主流程
- [ ] 3.4 补充 Vitest 单测：纯文本多段 `<tool_call>`、畸形 JSON、与结构化并存等边界

## 4. 文档与验收

- [ ] 4.1 在 `docs/ARCHITECTURE.md` 或前端 README 简短说明该开关用途与限制（不保证后端真实执行工具）
- [ ] 4.2 手工验收：弱模型仅输出标签时开关开可见工具条；开关关行为与改前一致
