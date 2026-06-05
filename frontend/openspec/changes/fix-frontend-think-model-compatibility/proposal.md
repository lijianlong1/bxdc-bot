## Why

当前前端存在三个问题：

1. **Think 模型兼容问题**：某些大模型（如 LangGraph 框架中的思考模型）会在响应内容中包含 `<think></think>` 标签，当前代码没有处理这种格式，导致思考内容直接显示给用户。

2. **流式输出问题**：TChat 组件的 `is-stream-load` 属性设置为 `false`，禁用了流式加载效果，用户无法看到大模型输出时的打字机效果。

3. **Thinking 动画不够流畅**：思考状态的加载动画不够自然，需要优化动画效果。

## What Changes

### 1. Think 模型兼容
- 添加 `removeThinkTags()` 函数，使用正则表达式 `/<think[\s\S]*?<\/think>/gi` 过滤 think 标签
- 在 `extractContent()` 和 `extractMessageContent()` 中应用过滤逻辑
- 在 `applyAssistantContent()` 中双重过滤，确保思考内容不会显示给用户

### 2. 流式输出优化
- 修改 TChat 组件的 `:is-stream-load` 属性从 `false` 改为 `true`
- 启用打字机效果，消息内容逐字显示

### 3. Thinking 动画优化
- 添加 GPU 加速优化（`will-change`、`transform: translateZ(0)`、`backface-visibility: hidden`）
- 使用 `cubic-bezier(0.4, 0, 0.2, 1)` 动画曲线，更流畅自然
- 优化 `thinkingBob` 动画：添加 4 个关键帧和缩放效果
- 优化 `thinkingPulse` 动画：添加微小缩放效果，增强呼吸感
- 优化 `thinkingWave` 动画：添加淡入淡出效果

## Capabilities

### New Capabilities
- `think-model-support`：支持包含思考过程的模型输出
- `streaming-display`：流畅的流式输出展示效果
- `smooth-thinking-animation`：流畅的思考状态动画

### Modified Capabilities
- `message-rendering`：增强消息渲染，支持 think 标签过滤和流式输出

## Impact

- **代码库**：修改 `src/composables/useChat.ts` 和 `src/components/MessageList.vue`
- **依赖**：无需新增依赖，纯 CSS/TypeScript 修改
- **系统**：提升用户体验，无性能影响

## 修改文件清单

| 文件路径 | 修改内容 |
|---------|---------|
| `src/composables/useChat.ts` | 添加 `removeThinkTags()` 函数；在多处应用 think 标签过滤 |
| `src/components/MessageList.vue` | 启用流式加载；优化 thinking 动画样式和关键帧 |

## 任务状态

✅ 全部完成