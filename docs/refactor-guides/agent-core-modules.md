# Agent-core 功能模块说明

## 文档说明

- **文档用途**：展示 agent-core 内部功能模块划分，供开发人员理解系统职责
- **阅读对象**：后端开发人员、架构师
- **架构前提**：agent-core 直连 LLM API 和 Mem0，通过回调与 skill-gateway 交互

---

## 架构定位

```
┌─────────────────────────────────────────────────────────────┐
│                        外部服务层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   LLM API   │  │    Mem0     │  │   Skill-gateway     │ │
│  │ (GPT/Claude)│  │  (记忆服务)  │  │   (Skill执行/日志)   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼────────────┘
          │                │                    │
          │ ① LLM调用      │ ② 记忆读写        │ ③ Skill回调
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent-core (Node.js)                    │
│                       ReAct 推理引擎层                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  核心模块                                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │ ReAct引擎 │  │ LLM客户端 │  │ 记忆管理  │              │ │
│  │  │ (循环)    │  │ (API调用) │  │ (Mem0)   │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘              │ │
│  │                                                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │ Skill调度 │  │ 确认流   │  │ 日志上报  │              │ │
│  │  │ (回调)   │  │ (暂停)   │  │ (异步)   │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘              │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  支撑模块                                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │ 配置管理  │  │ 错误处理  │  │ 日志记录  │              │ │
│  │  │ (Env)    │  │ (Retry)  │  │ (本地)   │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心模块详解

### 1. ReAct 引擎（ReactEngine）

**模块定位**：系统核心，驱动多轮推理循环

**主要职责**：
- 维护对话上下文（多轮历史消息）
- 编排 Thought → Action → Observation 循环
- 管理对话状态（正常执行 / 等待确认 / 已完成）
- 生成 SSE 事件流返回给调用方

**工作流程**：
```
接收用户输入 + 历史上下文 + 可用Skill
    ↓
检索记忆（可选）
    ↓
循环开始：
  ├─ 调用LLM生成思考（Thought）
  ├─ 判断是否需要调用Skill
  │   ├─ 否 → 生成回复 → 结束
  │   └─ 是 → 生成Tool Call
  ├─ 执行Skill（回调gateway）
  ├─ 接收执行结果（Observation）
  └─ 继续循环或结束
    ↓
存储记忆（可选）
    ↓
结束对话，上报日志
```

**关键类/函数**：
```typescript
class ReActEngine {
  // 启动对话推理
  async run(input: RunInput, stream: EventStream): Promise<void>;
  
  // 单轮推理
  private async step(context: Context): Promise<StepResult>;
  
  // 调用LLM生成思考
  private async think(context: Context): Promise<Thought>;
  
  // 执行Skill
  private async execute(toolCall: ToolCall): Promise<ToolOutput>;
  
  // 生成最终回复
  private async respond(context: Context): Promise<Message>;
}
```

---

### 2. LLM 客户端（LlmClient）

**模块定位**：直接对接大模型 API（OpenAI / Claude 等）

**主要职责**：
- 封装 LLM API 调用（支持流式返回）
- 管理 API Key 和 Base URL 配置
- 构建请求消息（系统提示 + 历史 + 当前输入）
- 处理函数调用（Function Calling）响应
- 错误重试和熔断

**支持功能**：
| 功能 | 说明 |
|------|------|
| 流式对话 | 使用 SSE 流式接收 LLM 输出 |
| 函数调用 | 解析 LLM 返回的 tool_calls |
| 多模型支持 | 可配置 GPT-4 / Claude-3 等 |
| 参数控制 | temperature / max_tokens / top_p |

**关键类/函数**：
```typescript
class LlmClient {
  // 流式对话
  async chatStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    onChunk: (chunk: string) => void
  ): Promise<ChatResult>;
  
  // 非流式（用于测试或简单场景）
  async chat(messages: ChatMessage[]): Promise<string>;
  
  // 构建系统提示（包含可用Skill描述）
  private buildSystemPrompt(skills: Skill[]): string;
}
```

---

### 3. 记忆管理（MemoryManager）

**模块定位**：对接 Mem0 服务，管理用户长期记忆

**主要职责**：
- 对话前检索相关记忆（根据用户输入）
- 对话结束时存储新记忆
- 将记忆注入 LLM 上下文（系统提示中）
- 管理记忆相关配置（启用/禁用）

**工作流程**：
```
用户输入 ──► 记忆检索 ──► Mem0 /msearch
              ↓
          返回记忆列表
              ↓
          注入系统提示（"用户偏好：..."）
              ↓
          对话结束 ──► 记忆存储 ──► Mem0 /madd
```

**关键类/函数**：
```typescript
class MemoryManager {
  // 检索记忆
  async retrieve(query: string, userId: string): Promise<Memory[]>;
  
  // 存储记忆
  async store(
    input: string,      // 用户输入
    output: string,      // AI回复
    userId: string
  ): Promise<void>;
  
  // 构建记忆提示
  buildMemoryPrompt(memories: Memory[]): string;
}
```

**配置项**：
```typescript
interface MemoryConfig {
  enabled: boolean;      // 是否启用记忆
  mem0Url: string;       // Mem0 服务地址
  topK: number;          // 检索条数（默认5）
}
```

---

### 4. Skill 调度（SkillDispatcher）

**模块定位**：调用 skill-gateway 执行 Skill

**主要职责**：
- 将 LLM 生成的 tool_call 转换为 HTTP 请求
- 调用 skill-gateway 的 Skill 执行接口
- 处理执行结果（成功/失败/超时）
- 记录调用耗时和状态

**调用流程**：
```
LLM返回 tool_call
    ↓
组装 SkillExecuteRequest
  ├─ skill_id
  ├─ input (arguments)
  ├─ context (user_id, conversation_id等)
    ↓
HTTP POST /api/v1/skills/{id}/execute
    ↓
解析 SkillExecuteResponse
  ├─ success=true → 返回output给LLM
  └─ success=false → 返回error给LLM
```

**关键类/函数**：
```typescript
class SkillDispatcher {
  // 执行Skill
  async execute(
    skillId: string,
    input: object,
    context: ExecutionContext
  ): Promise<SkillResult>;
  
  // 批量执行（用于OPENCLAW编排）
  async executeBatch(
    calls: SkillCall[],
    context: ExecutionContext
  ): Promise<SkillResult[]>;
  
  // 构建执行上下文
  private buildContext(
    conversationId: string,
    userId: string,
    messageId: string
  ): ExecutionContext;
}
```

---

### 5. 确认流处理（ConfirmationHandler）

**模块定位**：处理高风险 Skill 的用户确认流程

**主要职责**：
- 检测 Skill 是否需要确认（根据配置）
- 暂停推理循环，发送确认请求事件
- 等待用户确认结果（通过接口⑤）
- 超时处理（默认60秒）
- 恢复或终止执行

**状态流转**：
```
正常执行
    ↓
检测到 requires_confirmation=true
    ↓
发送 confirmation_request 事件（SSE）
    ↓
暂停循环，等待确认 ──► 超时 ──► 取消
    ↓
收到确认结果（接口⑤）
    ├─ confirmed=true → 继续执行Skill
    └─ confirmed=false → 返回取消消息
```

**关键类/函数**：
```typescript
class ConfirmationHandler {
  // 检查是否需要确认
  needsConfirmation(skillId: string): Promise<boolean>;
  
  // 发起确认请求
  async request(
    skillCall: SkillCall,
    timeoutMs: number
  ): Promise<ConfirmationRequest>;
  
  // 等待确认结果（阻塞）
  async waitForResponse(requestId: string): Promise<ConfirmationResult>;
  
  // 提交确认结果（接口⑤调用）
  submitResponse(requestId: string, confirmed: boolean): void;
}
```

---

### 6. 日志上报（LogReporter）

**模块定位**：异步上报对话记录和 Skill 调用日志

**主要职责**：
- 对话结束后组装完整对话记录
- 上报到 skill-gateway（接口③）
- 上报 Skill 调用详情（接口④）
- 失败重试（最多3次）
- 不影响主流程（异步执行）

**上报内容**：
| 类型 | 内容 | 接口 |
|------|------|------|
| 对话日志 | 消息列表、Token消耗、总耗时 | POST /internal/logs/conversation |
| 调用日志 | Skill调用详情、输入输出、耗时 | POST /internal/logs/skill-invocation |

**关键类/函数**：
```typescript
class LogReporter {
  // 上报对话日志
  async reportConversation(
    conversation: ConversationLog
  ): Promise<void>;
  
  // 上报Skill调用日志
  async reportSkillInvocation(
    invocations: SkillInvocation[]
  ): Promise<void>;
  
  // 异步队列（避免阻塞主流程）
  private queue: LogTask[];
  private async flush(): Promise<void>;
}
```

---

## 支撑模块

### 7. 配置管理（ConfigManager）

**管理配置项**：
```typescript
interface AgentCoreConfig {
  // 服务配置
  server: {
    host: string;        // 监听地址（仅内网）
    port: number;        // 端口
  };
  
  // LLM配置
  llm: {
    provider: 'openai' | 'anthropic' | 'custom';
    apiKey: string;
    baseUrl?: string;    // 自定义地址（可选）
    model: string;       // gpt-4 / claude-3-opus 等
    temperature: number;
    maxTokens: number;
  };
  
  // Mem0配置
  memory: {
    enabled: boolean;
    mem0Url: string;
  };
  
  // Skill-gateway配置
  skillGateway: {
    url: string;         // gateway地址
    timeout: number;     // 调用超时（毫秒）
  };
  
  // 日志配置
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}
```

---

### 8. 错误处理（ErrorHandler）

**错误分类**：
| 错误类型 | 说明 | 处理策略 |
|----------|------|----------|
| LLM_API_ERROR | LLM接口调用失败 | 重试3次，切换备用模型 |
| SKILL_TIMEOUT | Skill执行超时 | 返回超时提示 |
| SKILL_FAILURE | Skill执行失败 | 返回错误详情 |
| MEMORY_ERROR | Mem0调用失败 | 降级（不使用记忆）继续 |
| CONFIRMATION_TIMEOUT | 用户确认超时 | 自动取消 |

**重试策略**：
```typescript
interface RetryPolicy {
  maxRetries: number;      // 最大重试次数
  backoffMs: number;        // 退避间隔
  retryableErrors: string[]; // 可重试的错误码
}
```

---

### 9. 本地日志（LocalLogger）

**日志级别**：
- DEBUG：详细调试信息（开发环境）
- INFO：关键流程节点（生产环境）
- WARN：警告（如重试）
- ERROR：错误（如API调用失败）

**日志内容**：
- 请求/响应概要（脱敏）
- 执行耗时
- 错误堆栈

---

## 模块交互关系

```
                    ┌─────────────────┐
                    │   ReAct引擎     │
                    │  (核心编排)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  LLM客户端    │   │  记忆管理     │   │  Skill调度    │
│  (生成思考)   │   │  (检索/存储)  │   │  (回调gateway)│
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   LLM API     │   │     Mem0      │   │ Skill-gateway │
│  (外部直连)   │   │   (外部直连)  │   │  (回调目标)   │
└───────────────┘   └───────────────┘   └───────────────┘

        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  确认流处理   │   │  日志上报     │   │  配置管理     │
│  (暂停/恢复)  │   │  (异步上报)   │   │  (Env加载)    │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## 配置示例

```yaml
# config.yaml

server:
  host: "127.0.0.1"  # 仅内网
  port: 3000

llm:
  provider: "openai"
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4"
  temperature: 0.7
  maxTokens: 2000

memory:
  enabled: true
  mem0Url: "http://mem0.internal:8001"

skillGateway:
  url: "http://skill-gateway.internal:8080"
  timeout: 30000

logging:
  level: "info"
  format: "json"
```

---

## 接口映射

| 功能模块 | 外部接口 | 说明 |
|----------|----------|------|
| ReAct引擎 | `POST /internal/agent/run` (入口) | 接收请求，启动推理 |
| ReAct引擎 | `POST /internal/agent/confirm` | 接收确认结果，恢复执行 |
| Skill调度 | `POST /api/v1/skills/{id}/execute` (调用) | 回调 gateway 执行 Skill |
| 日志上报 | `POST /internal/logs/conversation` | 上报对话记录 |
| 日志上报 | `POST /internal/logs/skill-invocation` | 上报调用记录 |
| 记忆管理 | `POST /msearch` (Mem0) | 检索记忆 |
| 记忆管理 | `POST /madd` (Mem0) | 存储记忆 |
| LLM客户端 | `POST /v1/chat/completions` (LLM API) | LLM 对话 |

---

## 总结

**Agent-core 核心职责**：
1. **推理引擎**：ReAct 循环，编排多轮对话
2. **外部直连**：LLM API、Mem0（降低延迟）
3. **业务回调**：Skill 执行、日志上报（统一管控）
4. **状态管理**：对话上下文、确认流暂停恢复

**非职责**（由 Skill-gateway 负责）：
- Skill 执行的具体实现
- 数据持久化（数据库）
- 用户鉴权
- 会话管理（创建/查询对话）
