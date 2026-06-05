## 设计文档

### 1. Think 模型兼容设计

#### 1.1 问题分析

某些大模型在响应时会包含思考过程，格式如下：
```
<think>这是模型的思考过程，用户不应看到</think>
这是实际回复内容
```

当前代码没有处理这种格式，导致思考内容直接显示给用户。

#### 1.2 解决方案

在 `useChat.ts` 中添加 `extractContent` 函数的增强版本，过滤掉 `<think></think>` 标签。

**正则表达式设计**：
- 使用 `/<think[\s\S]*?<\/think>/gi` 匹配 think 标签及其内容
- 使用 `/<\/?think>/gi` 匹配单独的 think 标签

#### 1.3 代码位置

- 文件：`src/composables/useChat.ts`
- 修改函数：`extractContent`, `getMessageContent`, `extractMessageContent`

### 2. 流式输出设计

#### 2.1 问题分析

当前 TChat 组件配置：
- `:is-stream-load="false"` - 禁用流式加载
- `:text-loading="false"` - 禁用文本加载状态

这导致用户无法看到打字机效果。

#### 2.2 解决方案

修改 `MessageList.vue` 中的 TChat 组件配置：
- `:is-stream-load="true"` - 启用流式加载
- 确保消息内容正确增量更新

#### 2.3 代码位置

- 文件：`src/components/MessageList.vue`
- 修改组件：TChat

### 3. 数据流

```
SSE Event → extractMessageContent() → 过滤 think 标签 → applyAssistantContent() → 更新消息内容 → TChat 流式渲染
```

### 4. 测试用例

#### 4.1 Think 标签过滤测试

**输入**：
```
<think>我需要计算 1+2</think>
计算结果是：3
```

**期望输出**：
```
计算结果是：3
```

#### 4.2 流式输出测试

发送消息后，应看到内容逐字显示的打字机效果。