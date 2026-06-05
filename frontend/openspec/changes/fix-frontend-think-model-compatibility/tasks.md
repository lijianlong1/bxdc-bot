## 1. Think 模型兼容实现

- [x] 1.1 在 `useChat.ts` 中添加 `removeThinkTags` 函数，使用正则表达式 `/<think[\s\S]*?<\/think>/gi` 过滤 think 标签
- [x] 1.2 修改 `extractContent` 函数，在提取内容时自动过滤 think 标签
- [x] 1.3 修改 `extractMessageContent` 函数的兜底逻辑，也应用 think 标签过滤

## 2. 流式输出实现

- [x] 2.1 修改 `MessageList.vue` 中的 TChat 组件，将 `:is-stream-load` 从 `false` 改为 `true`
- [x] 2.2 确保 `applyAssistantContent` 函数正确处理增量内容更新

## 3. Thinking 动画优化

- [x] 3.1 添加 GPU 加速优化（`will-change`、`transform: translateZ(0)`、`backface-visibility: hidden`）
- [x] 3.2 使用 `cubic-bezier(0.4, 0, 0.2, 1)` 动画曲线替代 `ease-in-out`
- [x] 3.3 优化 `thinkingBob` 动画：添加 4 个关键帧，增加缩放效果，使摇头更自然
- [x] 3.4 优化 `thinkingPulse` 动画：添加微小缩放效果，增强呼吸感
- [x] 3.5 优化 `thinkingWave` 动画：添加淡入淡出效果，使波浪更流畅

## 4. 验证测试

- [x] 4.1 测试带 think 标签的消息解析：`<think>思考内容</think>实际回复` → `实际回复`
- [x] 4.2 测试流式输出打字机效果：消息内容逐字显示
- [x] 4.3 测试 thinking 动画流畅度