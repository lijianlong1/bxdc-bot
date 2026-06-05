# Agent-core 与 Skill-gateway 接口对接文档

## 文档说明

- **文档用途**：明确 agent-core 与 skill-gateway 之间的所有接口调用关系
- **阅读对象**：前后端开发人员、架构师
- **核心原则**：agent-core 只与 skill-gateway 交互，不直接对外暴露

---

## 接口总览

### 新架构说明

Agent-core 直接连接外部服务（LLM API、Mem0），Skill-gateway 作为业务网关负责任务调度、Skill 执行和日志收集。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Skill-gateway (Java)                          │
│                            业务网关层                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   统一入口    │  │   Skill 执行  │  │   会话管理   │  │   日志收集   │  │
│  │  (Frontend)   │  │ (Built-in/Ext)│  │  (CRUD)      │  │  (Audit)     │  │
│  └───────┬──────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────┼──────────────────────────────────────────────────────────────┘
           │ ① 代理请求（HTTP + SSE）
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Agent-core (Node.js)                          │
│                            ReAct 推理引擎                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         ReAct 循环                               │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │   │
│  │   │ 接收输入  │───►│ LLM 推理  │───►│ 调用 Skill│───►│ 返回结果 │  │   │
│  │   └──────────┘    └─────┬────┘    └─────┬────┘    └──────────┘  │   │
│  │                         │               │                      │   │
│  │                         ▼               ▼                      │   │
│  │                   ┌──────────┐    ┌──────────┐                  │   │
│  │                   │ LLM API  │    │ Skill    │                  │   │
│  │                   │ (直连)   │    │ Gateway  │                  │   │
│  │                   └──────────┘    │ (②回调)  │                  │   │
│  │                                    └──────────┘                  │   │
│  │                         ▼                                        │   │
│  │                   ┌──────────┐                                  │   │
│  │                   │  Mem0    │                                  │   │
│  │                   │ (记忆)   │                                  │   │
│  │                   └──────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │ ③ 日志上报（HTTP）                                           │
           ▼
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Skill-gateway (Java)                          │
│                         日志持久化 & Skill 执行                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent-core 外部依赖

| 服务 | 用途 | 连接方式 |
|------|------|----------|
| **LLM API** | 大模型推理（GPT/Claude 等） | 直连（HTTP + API Key） |
| **Mem0** | 长期记忆存储与检索 | 直连（HTTP） |
| **Skill-gateway** | Skill 执行回调、日志上报 | 内部 HTTP |

### 接口调用关系表

| 序号 | 调用方向 | 接口路径 | 功能目的 | 协议 |
|------|----------|----------|----------|------|
| ① | Skill-gateway → Agent-core | `POST /internal/agent/run` | 启动对话推理 | HTTP + SSE |
| ② | Agent-core → Skill-gateway | `POST /api/v1/skills/{id}/execute` | 执行 Skill（回调） | HTTP |
| ③ | Agent-core → Skill-gateway | `POST /internal/logs/conversation` | 上报对话日志 | HTTP |
| ④ | Agent-core → Skill-gateway | `POST /internal/logs/skill-invocation` | 上报 Skill 调用日志 | HTTP |
| ⑤ | Skill-gateway → Agent-core | `POST /internal/agent/confirm` | 提交用户确认结果 | HTTP |

### 非接口职责（Agent-core 内部实现）

以下连接为 Agent-core 内部实现，**不通过 Skill-gateway 代理**：

| 连接 | 用途 | 说明 |
|------|------|------|
| Agent-core → LLM API | 大模型对话、函数调用 | 直接使用 OpenAI/Claude API |
| Agent-core → Mem0 | 记忆检索、记忆存储 | 调用 Mem0 服务的 `/msearch` 和 `/madd` |

---

## 接口 ①：对话运行（Skill-gateway → Agent-core）

### 功能说明

Skill-gateway 接收前端用户消息后，转发给 agent-core 启动 ReAct 推理循环。Agent-core 内部执行：

1. **记忆检索**（可选）：调用 Mem0 服务查询用户相关记忆
2. **LLM 推理**：直接调用 LLM API（OpenAI/Claude 等）
3. **Skill 执行**：通过接口 ② 回调 Skill-gateway 执行 Skill
4. **记忆存储**：对话结束后调用 Mem0 服务存储新记忆
5. **日志上报**：通过接口 ③④ 上报日志

Agent-core 通过 SSE 流式返回推理过程和结果。

### 接口定义

```yaml
POST /internal/agent/run
```

### 请求头

| 头字段 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| X-Conversation-Id | 是 | 对话 ID | `conv_abc123` |
| X-User-Id | 是 | 用户 ID | `user_001` |
| X-Request-Id | 是 | 请求追踪 ID | `req_uuid123` |
| Content-Type | 是 | 固定值 | `application/json` |

### 请求体

```typescript
interface AgentRunRequest {
  // 用户输入消息
  message: string;
  
  // 对话历史（最近 N 轮，用于上下文）
  history: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: Array<{
      id: string;
      name: string;
      arguments: object;
    }>;
    tool_outputs?: Array<{
      tool_call_id: string;
      output: string;
    }>;
  }>;
  
  // 当前对话可用的 Skill 列表
  enabled_skills: Array<{
    skill_id: string;
    name: string;
    description: string;
    type: 'api' | 'ssh' | 'template' | 'openclaw';
    input_schema?: object;  // 参数 schema
  }>;
  
  // 用户相关信息（用于记忆检索）
  user_context?: {
    user_id: string;
    user_name?: string;
    // 其他用户画像信息
  };
  
  // 可选：模型配置
  config?: {
    model?: string;        // 模型名称，默认使用系统配置
    temperature?: number;  // 温度，默认 0.7
    max_tokens?: number;   // 最大 token 数
    base_url?: string;     // 自定义 LLM 地址（可选）
    api_key?: string;      // 自定义 API Key（可选，否则用系统默认）
  };
  
  // 可选：记忆配置
  memory_config?: {
    enabled: boolean;      // 是否启用记忆
    mem0_url?: string;     // Mem0 服务地址（可选）
  };
}
```

### 响应（SSE 流）

```typescript
// 事件类型枚举
type SSEEvent = 
  | MemoryRetrieveEvent  // 记忆检索结果
  | ThoughtEvent         // AI 思考过程
  | ToolCallEvent        // 准备调用 Skill
  | ToolOutputEvent      // Skill 返回结果
  | ConfirmationEvent    // 需要用户确认
  | MessageEvent         // AI 回复内容（流式）
  | MemoryStoreEvent     // 记忆存储完成
  | DoneEvent            // 完成
  | ErrorEvent;          // 错误

// 1. 记忆检索事件（当启用记忆时，首先触发）
interface MemoryRetrieveEvent {
  event: 'memory_retrieve';
  data: {
    query: string;         // 检索查询语句（用户输入）
    memories: Array<{
      content: string;     // 记忆内容
      score: number;       // 相关度分数
      timestamp: string;   // 记忆时间
    }>;
    count: number;         // 检索到的记忆数量
  };
}

// 2. 思考事件
interface ThoughtEvent {
  event: 'thought';
  data: {
    step: number;           // 思考步骤序号
    content: string;      // 思考内容（如："我需要查询订单数据"）
    timestamp: number;    // 时间戳
  };
}

// 3. 工具调用事件
interface ToolCallEvent {
  event: 'tool_call';
  data: {
    tool_call_id: string;   // 调用 ID
    name: string;           // Skill 名称
    arguments: object;        // 调用参数
    display_name?: string;   // 展示名称（用于前端显示）
  };
}

// 4. 工具输出事件
interface ToolOutputEvent {
  event: 'tool_output';
  data: {
    tool_call_id: string;   // 对应 tool_call 的 ID
    output: string;          // 输出结果（JSON 字符串）
    latency_ms: number;      // 执行耗时
  };
}

// 5. 确认请求事件
interface ConfirmationEvent {
  event: 'confirmation_request';
  data: {
    request_id: string;      // 确认请求 ID
    tool_call_id: string;    // 关联的工具调用
    skill_name: string;      // Skill 名称
    description: string;     // 操作描述
    params: object;          // 待确认的参数
    timeout_seconds: number; // 超时时间（默认 60）
  };
}

// 6. 消息事件（AI 回复，流式）
interface MessageEvent {
  event: 'message';
  data: {
    content: string;         // 本次推送的内容片段
    is_complete: boolean;   // 是否最后一段
    message_id: string;      // 消息 ID
  };
}

// 7. 记忆存储事件（对话结束后触发）
interface MemoryStoreEvent {
  event: 'memory_store';
  data: {
    count: number;           // 存储的记忆条数
    query: string;           // 存储的查询语句
  };
}

// 8. 完成事件
interface DoneEvent {
  event: 'done';
  data: {
    message_id: string;      // 完整消息 ID
    token_count: number;     // 总 token 数
    latency_ms: number;      // 总耗时
  };
}

// 9. 错误事件
interface ErrorEvent {
  event: 'error';
  data: {
    code: string;           // 错误码
    message: string;        // 错误信息
    retryable: boolean;     // 是否可重试
  };
}
```

### SSE 示例（带记忆）

```
event: memory_retrieve
data: {"query": "用户昨天问了什么", "memories": [{"content": "用户昨天查询了订单数据", "score": 0.95, "timestamp": "2024-01-14T10:00:00Z"}], "count": 1}

event: thought
data: {"step": 1, "content": "用户想查询昨天的订单，结合记忆用户昨天也查过订单数据", "timestamp": 1705312800000}

event: tool_call
data: {"tool_call_id": "call_123", "name": "query_orders", "arguments": {"date": "2024-01-14", "status": "all"}}

event: tool_output
data: {"tool_call_id": "call_123", "output": "{\"count\": 5, \"orders\": [...]}", "latency_ms": 234}

event: message
data: {"content": "我帮您查询了昨天的订单", "is_complete": false, "message_id": "msg_456"}

event: message
data: {"content": "，共有 5 笔订单。", "is_complete": true, "message_id": "msg_456"}

event: memory_store
data: {"count": 1, "query": "用户查询昨天订单，返回 5 笔"}

event: done
data: {"message_id": "msg_456", "token_count": 150, "latency_ms": 1200}
```

### 功能对应

| 功能场景 | 事件序列 |
|----------|----------|
| 简单问答（无记忆）| thought → message → done |
| 简单问答（有记忆）| memory_retrieve → thought → message → memory_store → done |
| 调用 1 个 Skill | thought → tool_call → tool_output → message → done |
| 调用多个 Skill | thought → tool_call → tool_output → tool_call → tool_output → message → done |
| 需要确认 | thought → tool_call → confirmation_request → 【等待确认】→ tool_output → message → done |
| 发生错误 | thought → error 或 tool_call → tool_output → error |
| 发生错误（记忆已检索）| memory_retrieve → thought → error |

---

## 接口 ②：Skill 执行（Agent-core → Skill-gateway）

### 功能说明

Agent-core 在 ReAct 循环中需要调用 Skill 时，通过此接口请求 skill-gateway 执行。Skill-gateway 根据 Skill 类型（built-in/extension）路由到对应执行器。

### 接口定义

```yaml
POST /api/v1/skills/{skill_id}/execute
```

### 请求头

| 头字段 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| X-Conversation-Id | 是 | 对话 ID | `conv_abc123` |
| X-User-Id | 是 | 用户 ID | `user_001` |
| X-Message-Id | 是 | 当前消息 ID | `msg_456` |
| X-Tool-Call-Id | 是 | 本次调用 ID | `call_123` |
| Content-Type | 是 | 固定值 | `application/json` |

### 请求体

```typescript
interface SkillExecuteRequest {
  // 输入参数（根据 Skill 的 input_schema 定义）
  input: object;
  
  // 执行上下文
  context?: {
    // 用户相关信息（用于记忆查询等）
    user_preferences?: object;
    
    // 会话级变量（跨 Skill 共享数据）
    session_variables?: Record<string, any>;
  };
}
```

### 请求示例

```json
{
  "input": {
    "date": "2024-01-14",
    "status": "cancelled",
    "limit": 10
  },
  "context": {
    "user_preferences": {
      "default_timezone": "Asia/Shanghai"
    },
    "session_variables": {
      "last_query_date": "2024-01-13"
    }
  }
}
```

### 响应体

```typescript
interface SkillExecuteResponse {
  // 是否执行成功
  success: boolean;
  
  // 输出结果（JSON 字符串或对象）
  output?: string | object;
  
  // 错误信息（失败时返回）
  error?: {
    code: string;        // 错误码
    message: string;     // 错误描述
    details?: object;    // 详细错误信息
  };
  
  // 执行元数据
  metadata: {
    latency_ms: number;     // 执行耗时
    executed_at: string;     // 执行时间（ISO 8601）
    skill_id: string;       // Skill ID
    skill_name: string;     // Skill 名称快照
  };
}
```

### 响应示例（成功）

```json
{
  "success": true,
  "output": {
    "count": 5,
    "orders": [
      {"id": "ORD001", "amount": 199.99, "status": "cancelled"},
      {"id": "ORD002", "amount": 299.99, "status": "cancelled"}
    ]
  },
  "metadata": {
    "latency_ms": 234,
    "executed_at": "2024-01-15T14:30:00.000Z",
    "skill_id": "query_orders",
    "skill_name": "查询订单"
  }
}
```

### 响应示例（失败）

```json
{
  "success": false,
  "error": {
    "code": "SKILL_EXECUTION_FAILED",
    "message": "订单服务返回 500 错误",
    "details": {
      "status_code": 500,
      "upstream_error": "Internal Server Error"
    }
  },
  "metadata": {
    "latency_ms": 120,
    "executed_at": "2024-01-15T14:30:00.000Z",
    "skill_id": "query_orders",
    "skill_name": "查询订单"
  }
}
```

### 功能对应

| 场景 | 调用方 | 处理方 | 说明 |
|------|--------|--------|------|
| 执行 Built-in Skill | Agent-core | Skill-gateway 本地执行 | api_caller、compute、ssh_executor |
| 执行 Extension Skill | Agent-core | Skill-gateway 代理执行 | 根据 type 路由到 API/SSH/模板/编排 |
| 执行失败 | Agent-core | Skill-gateway | Agent-core 根据错误码决定是否重试或报错 |

---

## 接口 ③：对话日志上报（Agent-core → Skill-gateway）

### 功能说明

对话完成后，agent-core 将完整对话记录上报给 skill-gateway，由 skill-gateway 异步写入数据库。

### 接口定义

```yaml
POST /internal/logs/conversation
```

### 请求头

| 头字段 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| X-Conversation-Id | 是 | 对话 ID | `conv_abc123` |
| X-User-Id | 是 | 用户 ID | `user_001` |
| X-Request-Id | 是 | 请求追踪 ID | `req_uuid123` |
| Content-Type | 是 | 固定值 | `application/json` |

### 请求体

```typescript
interface ConversationLogRequest {
  // 对话基本信息
  conversation_info: {
    conversation_id: string;
    user_id: string;
    title?: string;
    enabled_skills: string[];  // Skill ID 列表
  };
  
  // 本次新增的消息列表
  messages: Array<{
    message_id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    created_at: string;  // ISO 8601
    
    // 工具调用记录（仅 assistant 消息有）
    tool_calls?: Array<{
      tool_call_id: string;
      skill_id: string;
      name: string;
      arguments: object;
    }>;
    
    // Token 消耗（可选）
    token_count?: {
      prompt: number;
      completion: number;
      total: number;
    };
  }>;
  
  // 元数据
  metadata: {
    started_at: string;      // 对话开始时间
    ended_at: string;        // 对话结束时间
    total_latency_ms: number; // 总耗时
    model: string;           // 使用的模型
  };
}
```

### 功能对应

| 数据用途 | 存储位置 | 查询方式 |
|----------|----------|----------|
| 用户查看历史 | MySQL - conversation_messages | 对话页面向上滚动加载 |
| 审计追踪 | MySQL - conversation_messages | 日志查看弹窗 |
| 数据分析 | MySQL + 可能的数仓 | 管理后台报表 |

---

## 接口 ④：Skill 调用日志上报（Agent-core → Skill-gateway）

### 功能说明

每次 Skill 调用完成后，agent-core 将调用详情上报给 skill-gateway，用于审计和监控。

### 接口定义

```yaml
POST /internal/logs/skill-invocation
```

### 请求体

```typescript
interface SkillInvocationLogRequest {
  // 调用基本信息
  invocations: Array<{
    log_id: string;              // 日志 ID（UUID）
    conversation_id: string;
    message_id: string;
    user_id: string;
    
    // Skill 信息
    skill_id: string;
    skill_name: string;          // 快照（避免 Skill 改名后查询不到）
    skill_type: string;
    
    // 调用详情
    input: object;               // 输入参数（可脱敏）
    output?: string | object;    // 输出结果（可截断）
    success: boolean;
    error_code?: string;
    error_message?: string;
    
    // 时间
    requested_at: string;        // 请求时间
    completed_at: string;        // 完成时间
    latency_ms: number;          // 耗时
  }>;
}
```

### 功能对应

| 数据用途 | 说明 |
|----------|------|
| 审计查询 | 查看某次调用的输入输出 |
| 故障排查 | 根据错误码定位问题 |
| 性能监控 | 统计 Skill 调用耗时 |
| 用量统计 | 统计每个 Skill 被调用次数 |

---

## 接口 ⑤：确认结果提交（Skill-gateway → Agent-core）

### 功能说明

当 Skill 需要用户确认时，agent-core 通过 SSE 发送 confirmation_request 事件并暂停执行。用户在前端确认后，skill-gateway 通过此接口将结果提交给 agent-core，agent-core 继续执行。

### 接口定义

```yaml
POST /internal/agent/confirm
```

### 请求体

```typescript
interface AgentConfirmRequest {
  // 确认请求 ID（来自 confirmation_request 事件）
  request_id: string;
  
  // 对话标识
  conversation_id: string;
  message_id: string;
  
  // 确认结果
  confirmed: boolean;  // true: 确认执行, false: 取消
  
  // 可选：用户备注（如取消时填写原因）
  comment?: string;
}
```

### 响应体

```typescript
interface AgentConfirmResponse {
  // 是否成功接收确认
  accepted: boolean;
  
  // 错误信息（如确认已超时）
  error?: {
    code: string;
    message: string;
  };
}
```

### 功能对应

| 场景 | 交互流程 |
|------|----------|
| 用户确认 | confirmation_request → 【前端弹窗】→ 用户点击确认 → skill-gateway → /internal/agent/confirm → agent-core 继续执行 tool_call |
| 用户取消 | confirmation_request → 【前端弹窗】→ 用户点击取消 → skill-gateway → /internal/agent/confirm → agent-core 返回取消消息 |
| 超时取消 | confirmation_request → 60秒无响应 → agent-core 自动取消 → error 事件 |

---

## 接口调用时序图

### 完整对话场景（新架构：Agent-core 直连 LLM 和 Mem0）

```
用户     Frontend    Skill-gateway      Agent-core       LLM API      Mem0      数据库
 |          |             |                |              |          |          |
 |─输入消息─►│             │                │              │          |          |
 |          │─①/run──────►│                │              │          |          |
 |          │ (SSE建立)   │──转发─────────►│              │          |          |
 |          │             │ X-Conversation │              │          |          |
 |          │             │ X-User-Id      │              │          |          |
 |          │             │ enabled_skills │              │          |          |
 |          │             │                │              │          |          |
 |          │             │                │─记忆检索─────►│          ├─msearch──►
 |          │◄─memory_retrieve─────────────│◄─返回记忆─────│◄─────────┤          │
 |          │             │                │              │          |          |
 |          │             │                │────LLM请求────►│          |          |
 |          │             │                │  函数定义     │          |          |
 |          │             │                │  历史消息     │          |          |
 |          │◄─thought──────────────────────│◄─思考内容─────│          |          |
 |          │             │                │              │          |          |
 |          │             │                │◄─调用Skill────┤          |          |
 |          │             │◄─②/execute────│  (需要执行)   │          |          |
 |          │             │ X-Tool-Call-Id │              │          |          |
 |          │             │                │              │          |          |
 |          │             │──执行Skill───────────────────────────────────────►
 |          │             │◄─返回结果────────────────────────────────────────│
 |          │             │                │              │          |          |
 |          │◄─tool_output────────────────│◄─执行结果─────│          |          |
 |          │             │                │              │          |          |
 |          │             │                │────继续LLM───►│          |          |
 |          │◄─message──────────────────────│◄─流式回复─────│          |          |
 |          │ (逐字推送)  │                │              │          |          |
 |          │◄─memory_store───────────────│              │          ├─madd─────►
 |          │◄─done───────────────────────│◄─完成────────│          |          |
 |          │             │                │              │          |          |
 |          │             │◄─③日志上报────│              │          |          |
 |          │             │ 异步写入─────────────────────────────────────────────►
 |          │             │                │              │          |          |
 |◄─展示结果│             │                │              │          |          │
```

### 说明

| 连接 | 说明 |
|------|------|
| Agent-core ↔ LLM API | **直连**，进行 LLM 推理、函数调用 |
| Agent-core ↔ Mem0 | **直连**，检索和存储用户记忆 |
| Agent-core ↔ Skill-gateway | **回调**，执行 Skill 和上报日志 |
| Skill-gateway ↔ 数据库 | 业务数据持久化 |

### 关键变化

**旧架构**：
- Skill-gateway 代理所有外部调用（LLM、Mem0、数据库）
- Agent-core 只与 Skill-gateway 交互

**新架构**：
- Agent-core **直连** LLM API 和 Mem0
- Agent-core 只通过 Skill-gateway **回调** Skill 执行和日志上报
- 减少中间跳转，降低延迟，简化推理链路

### 确认流场景

```
用户          Frontend         Skill-gateway        Agent-core
 |              |                   |                   |
 │              │◄─ confirmation_request ────────────────│
 │              │  (SSE 事件)                          │
 │              │  暂停执行                            │
 │◄─ 弹窗 ──────│                   │                   │
 │              │                   │                   │
 │── 点击确认 ──►│                   │                   │
 │              │── ⑤ /confirm ───►│                   │
 │              │  request_id       │                   │
 │              │  confirmed=true   │                   │
 │              │                   │── 提交确认 ──────►│
 │              │                   │                   │ 继续执行
 │              │◄─ tool_output ─────────────────────────│
 │              │                   │                   │
 │◄─ 展示结果 ──│                   │                   │
```

---

## 错误码定义

### Agent-core 返回的错误码

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| `AGENT_INIT_FAILED` | Agent 初始化失败 | 重试或报错 |
| `LLM_API_ERROR` | LLM 接口调用失败 | 切换模型或报错 |
| `TOOL_EXECUTION_FAILED` | Skill 执行失败 | 展示错误详情 |
| `TOOL_TIMEOUT` | Skill 执行超时 | 提示超时，建议重试 |
| `CONFIRMATION_TIMEOUT` | 用户确认超时 | 提示操作已取消 |
| `INVALID_TOOL_CALL` | 工具调用参数错误 | 内部错误，需排查 |
| `RATE_LIMITED` | 请求频率超限 | 限流提示 |
| `CONTEXT_LENGTH_EXCEEDED` | 上下文超长 | 截断历史或报错 |

### Skill-gateway 返回的错误码（Skill 执行接口）

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| `SKILL_NOT_FOUND` | Skill 不存在 | 检查 Skill ID |
| `SKILL_DISABLED` | Skill 已禁用 | 提示 Skill 不可用 |
| `SKILL_EXECUTION_FAILED` | 执行失败 | 查看错误详情 |
| `PARAM_VALIDATION_FAILED` | 参数校验失败 | 检查参数格式 |
| `UPSTREAM_ERROR` | 上游服务错误 | 查看上游状态 |
| `TIMEOUT` | 执行超时 | 增加超时时间或优化 |
| `PERMISSION_DENIED` | 无权限执行 | 检查用户权限 |
| `CONFIRMATION_REQUIRED` | 需要确认（同步返回） | 走确认流 |

---

## 安全配置

### Agent-core 侧

```yaml
# 仅监听内网地址
server:
  host: 127.0.0.1  # 或内部 IP，不绑定 0.0.0.0
  port: 3000

# IP 白名单拦截
security:
  whitelist:
    ips: 
      - "10.0.0.0/8"      # 内网网段
      - "172.16.0.0/12"   # 内网网段
      - "127.0.0.1"       # 本机
```

### Skill-gateway 侧

```yaml
# 调用 agent-core 配置
agent:
  core:
    url: http://127.0.0.1:3000  # 内网地址
    timeout: 30000              # 30 秒超时
    retry: 3                    # 失败重试 3 次
```

---

## 附录：接口对照表

| 功能场景 | 调用方向 | 接口 | 关键头信息 | 响应方式 |
|----------|----------|------|------------|----------|
| 启动对话 | gateway → core | `POST /internal/agent/run` | X-Conversation-Id, X-User-Id, X-Enabled-Skills | SSE 流 |
| 执行 Skill | core → gateway | `POST /api/v1/skills/{id}/execute` | X-Conversation-Id, X-User-Id, X-Tool-Call-Id | JSON |
| 上报对话日志 | core → gateway | `POST /internal/logs/conversation` | X-Conversation-Id, X-User-Id | JSON（异步处理） |
| 上报调用日志 | core → gateway | `POST /internal/logs/skill-invocation` | X-Conversation-Id, X-User-Id | JSON（异步处理） |
| 提交确认结果 | gateway → core | `POST /internal/agent/confirm` | X-Conversation-Id | JSON |
