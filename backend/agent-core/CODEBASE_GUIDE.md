# Agent Core 代码库完全指南

## 📋 目录

1. [项目概述](#1-项目概述)
2. [架构设计](#2-架构设计)
3. [模块详细说明](#3-模块详细说明)
4. [文件索引](#4-文件索引)
5. [开发规范](#5-开发规范)
6. [环境变量参考](#6-环境变量参考)

---

## 1. 项目概述

### 1.1 项目简介

**Agent Core** 是一个基于 NestJS + LangGraph 的智能 Agent 服务平台，提供：

- 🤖 基于 OpenAI GPT 的智能对话 Agent
- 🔧 丰富的工具生态（SSH、API、计算、Linux 脚本等）
- 🧩 动态技能加载机制（SKILL.md）
- 📝 长期记忆能力（mem0 集成）
- 🔄 技能确认工作流（中断/恢复机制）
- 📊 实时执行追踪（SSE 流式响应）

### 1.2 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 框架 | NestJS | Node.js 服务端框架，提供 DI、模块化 |
| AI 框架 | LangChain + LangGraph | LLM 调用、Agent 工作流、状态管理 |
| LLM | OpenAI GPT-4 | 核心大语言模型 |
| HTTP 客户端 | Axios | 外部 API 调用 |
| 配置管理 | @nestjs/config | 环境变量管理 |
| 验证 | Zod | 运行时类型验证 |
| 序列化 | js-yaml | YAML 解析（SKILL.md） |

### 1.3 目录结构

```
backend/agent-core/
├── src/                          # 源代码目录
│   ├── agent/                    # Agent 核心模块
│   │   ├── agent.ts              # Agent 工厂
│   │   └── tasks-state.ts        # 任务状态管理
│   ├── controller/               # HTTP 控制器
│   │   ├── agent.controller.ts   # Agent 主控制器
│   │   ├── health.controller.ts  # 健康检查
│   │   ├── memory.controller.ts  # 记忆管理
│   │   └── user.controller.ts    # 用户相关
│   ├── features/                 # 特性模块
│   │   ├── avatar/               # 头像服务
│   │   └── skills/               # 技能代理
│   ├── mem/                      # 长期记忆
│   │   └── memory.service.ts     # 记忆服务
│   ├── skills/                   # 技能系统
│   │   ├── skill.manager.ts      # 技能管理器
│   │   ├── types.ts              # 类型定义
│   │   └── ...                   # 主进程/渲染进程技能代码
│   ├── tools/                    # 工具实现
│   │   ├── java-skills.ts        # Java Gateway 工具
│   │   ├── manage-tasks.ts       # 任务管理工具
│   │   └── tool-trace-context.ts # 工具追踪
│   ├── utils/                    # 工具函数
│   │   ├── logger.service.ts     # 日志服务
│   │   ├── llm-merge.ts          # LLM 配置合并
│   │   └── ...                   # 其他工具
│   ├── app.module.ts             # 根模块
│   └── main.ts                   # 入口文件
├── SKILLs/                       # 技能定义目录
│   ├── hello-world/SKILL.md
│   └── ...
├── dist/                         # 编译输出
├── test/                         # 测试文件
├── package.json                  # 项目配置
├── .env.example                  # 环境变量示例
└── readme.md                     # 版本说明
```

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Frontend)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP + SSE
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Core (NestJS)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Controllers │  │   Services  │  │    Tools    │              │
│  │             │  │             │  │             │              │
│  │/agent/run   │──│ AgentFactory│──│ JavaSshTool │              │
│  │/agent/confirm│ │ MemoryService│  │ JavaApiTool │              │
│  │/health      │  │ SkillManager│  │ JavaCompute │              │
│  │...          │  │ ...         │  │ ...         │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    LangGraph Agent                           ││
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐                ││
│  │   │  LLM    │───▶│  Tools  │───▶│ State   │                ││
│  │   │(OpenAI) │    │         │    │         │                ││
│  │   └─────────┘    └─────────┘    └─────────┘                ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬───────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Java Skill      │ │   mem0 Service  │ │   SKILL.md      │
│ Gateway         │ │   (Memory)      │ │   (Filesystem)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.2 核心流程

#### 2.2.1 Agent 执行流程

```
1. 客户端 POST /agent/run
   └─ 参数：instruction（指令）、context（上下文）、history（历史对话）

2. AgentController.runTask()
   ├─ 创建 SSE Subject（用于流式响应）
   ├─ 调用 AgentFactory.createAgent() 创建 Agent 实例
   ├─ 检索长期记忆（MemoryService.searchMemories）
   ├─ 构建完整提示词（技能上下文 + 策略 + 记忆）
   └─ 启动 LangGraph 流

3. LangGraph Agent 执行（ReAct 模式）
   ├─ LLM 思考并决定调用哪个工具
   ├─ 执行工具（如 SSH、API 调用等）
   ├─ 工具返回结果
   ├─ LLM 根据结果继续思考或给出最终回答
   └─ 循环直到任务完成

4. 流式响应（SSE）
   ├─ agent_message: LLM 生成的文本
   ├─ tool_status: 工具调用状态（running/completed/failed）
   ├─ tool_trace: 工具执行详情
   ├─ confirmation_request: 需要用户确认的操作
   └─ 完成或错误时结束流

5. 记忆更新
   └─ 对话结束后，提取关键信息存储到 mem0
```

#### 2.2.2 技能确认流程

```
1. Agent 执行到高风险操作（如 rm -rf、重启服务）
   └─ 工具层调用 interrupt() 暂停 Agent

2. Controller 检测到 INTERRUPT 信号
   ├─ 提取中断信息（工具名、参数、摘要）
   ├─ 通过 SSE 发送 confirmation_request 事件
   └─ 创建 PendingConfirmation 等待用户响应

3. 前端展示确认对话框
   └─ 用户点击"确认"或"取消"

4. 前端 POST /agent/confirm
   ├─ 调用 PendingConfirmation.resolve()
   └─ 恢复 Agent 执行

5. Agent 继续执行
   ├─ 用户确认：发送 Command({ resume: { confirmed: true } })
   └─ 用户取消：发送 Command({ resume: { confirmed: false } })，优雅终止
```

---

## 3. 模块详细说明

### 3.1 Agent 核心模块 (`src/agent/`)

#### 3.1.1 agent.ts - Agent 工厂

**职责**：创建和配置 LangGraph ReAct Agent

**核心功能**：
- 初始化 ChatOpenAI LLM 实例
- 收集并注册所有可用工具
- 使用 `createReactAgent` 创建 Agent
- 配置共享的 MemorySaver 用于状态检查点

**关键类**：

| 类/函数 | 说明 |
|---------|------|
| `AgentFactory` | 工厂类，提供 `createAgent` 静态方法 |
| `createAgent` | 异步工厂方法，返回配置好的 Agent 实例 |

**工具注册顺序**：
1. SSH 工具（条件注册，需要用户认证或显式开启）
2. API 调用工具
3. 技能生成工具
4. 数学计算工具
5. Linux 脚本工具
6. 服务器查询工具
7. Gateway 扩展工具（动态加载）
8. 文件系统技能工具（来自 SKILL.md）
9. 任务管理工具

**代码示例**：
```typescript
const { agent, plannerModel, baseTools } = await AgentFactory.createAgent(
  'http://localhost:18080',    // Gateway URL
  'token',                    // API Token
  'sk-xxx',                   // OpenAI API Key
  { 
    modelName: 'gpt-4', 
    baseUrl: 'https://api.openai.com',
    sessionId: 'sess-001' 
  },
  skillManager,               // 技能管理器实例
  'user-001'                  // 用户ID
);
```

---

#### 3.1.2 tasks-state.ts - 任务状态管理

**职责**：管理 Agent 执行过程中的任务状态

**核心概念**：
- `TaskStatusValue`: 任务状态枚举（pending/in_progress/completed/cancelled）
- `TasksStatusMap`: 任务状态映射表
- `AgentAnnotation`: LangGraph 状态注解定义

**关键函数**：

| 函数 | 说明 |
|------|------|
| `rebuildTasksStatusFromMessages` | 从消息历史重建任务状态 |
| `buildTasksSummary` | 生成任务状态摘要文本 |
| `preModelHook` | LLM 调用前钩子，注入任务摘要 |

**使用场景**：
- 用户请求包含多个子任务时，Agent 使用 `manage_tasks` 工具跟踪进度
- 防止重复执行已完成的任务
- 让 LLM 了解当前任务进度，优化决策

---

### 3.2 控制器模块 (`src/controller/`)

#### 3.2.1 agent.controller.ts - Agent 主控制器

**职责**：处理 Agent 相关的 HTTP 请求，实现 SSE 流式响应

**端点说明**：

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /agent/run` | @Sse() | 启动 Agent 任务，返回 SSE 流 |
| `POST /agent/confirm` | @Post() | 确认技能执行，恢复中断的 Agent |

**核心组件**：

| 组件 | 说明 |
|------|------|
| `PendingConfirmation` | 待确认信息结构体 |
| `pendingConfirmations` | 内存中的确认状态映射表 |
| `CONFIRMATION_TIMEOUT_MS` | 确认超时时间（5分钟） |

**策略提示词**（Policy Prompts）：

| 常量 | 用途 |
|------|------|
| `AGENT_SKILL_GENERATOR_POLICY` | 限制技能生成工具的使用条件 |
| `AGENT_TASK_TRACKING_POLICY` | 指导 Agent 跟踪多任务进度 |
| `AGENT_CONFIRMATION_UI_POLICY` | 说明确认流程通过 UI 按钮完成 |
| `AGENT_EXTENDED_SKILL_ROUTING_POLICY` | 优先使用扩展技能而非内置工具 |

**SSE 事件类型**：

| 事件类型 | 说明 |
|----------|------|
| `agent_message` | Agent 生成的文本消息 |
| `tool_status` | 工具调用状态更新 |
| `tool_trace` | 工具执行详情（参数、结果） |
| `confirmation_request` | 请求用户确认操作 |
| `llm_stats` | LLM 调用统计信息 |

---

#### 3.2.2 health.controller.ts - 健康检查

**端点**：`GET /health`

**返回**：
```json
{
  "status": "ok",
  "service": "agent-core",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptimeSeconds": 3600
}
```

**用途**：Kubernetes 健康探测、负载均衡器检查

---

#### 3.2.3 memory.controller.ts - 记忆管理

**端点**：`POST /memory/add`

**用途**：手动添加长期记忆（主要用于调试）

**请求体**：
```json
{
  "userId": "user-001",
  "text": "用户喜欢喝绿茶",
  "role": "user"
}
```

---

### 3.3 工具模块 (`src/tools/`)

#### 3.3.1 java-skills.ts - Java Gateway 工具集合

**职责**：提供与 Java Skill Gateway 通信的各类工具

**内置工具列表**：

| 工具类 | 名称 | 功能 |
|--------|------|------|
| `JavaSshTool` | ssh_executor | SSH 远程命令执行 |
| `JavaApiTool` | api_caller | HTTP API 调用 |
| `JavaComputeTool` | compute | 数学计算 |
| `JavaLinuxScriptTool` | linux_script_executor | Linux 脚本执行 |
| `JavaServerLookupTool` | server_lookup | 服务器信息查询 |
| `JavaSkillGeneratorTool` | skill_generator | 自然语言生成技能 |

**Zod Schema 定义**：
- `computeToolInputSchema`: 计算操作类型和参数
- `apiCallerToolInputSchema`: HTTP 请求参数
- `sshExecutorToolInputSchema`: SSH 连接和执行参数
- `skillGeneratorInputSchema`: 技能生成参数

**动态扩展工具**：
- `loadGatewayExtendedTools`: 从 Gateway 加载用户定义的扩展技能
- 自动转换为 LangChain DynamicStructuredTool
- 支持参数校验（JSON Schema → Zod Schema）

**确认机制**：
- 危险命令检测（rm -rf、reboot、mkfs 等）
- 扩展技能根据配置决定是否需要确认
- 使用 `interrupt()` 实现暂停等待

---

#### 3.3.2 manage-tasks.ts - 任务管理工具

**工具名**：`manage_tasks`

**功能**：在 Agent 执行过程中跟踪多个子任务的状态

**使用示例**：
```typescript
// Agent 调用 manage_tasks 注册子任务
manage_tasks({
  updates: [
    { id: "check-disk", label: "检查磁盘空间", status: "in_progress" },
    { id: "restart-nginx", label: "重启 Nginx", status: "pending" }
  ]
})
```

---

#### 3.3.3 tool-trace-context.ts - 工具追踪上下文

**职责**：管理工具调用的追踪上下文

**功能**：
- 维护当前活动的工具 ID 映射
- 净化工具参数和结果（敏感信息脱敏）
- 支持嵌套工具调用的追踪

---

### 3.4 技能模块 (`src/skills/`)

#### 3.4.1 skill.manager.ts - 技能管理器

**职责**：发现并加载 SKILL.md 技能定义文件

**技能发现机制**：

| 步骤 | 说明 |
|------|------|
| 1. 扫描目录 | 扫描 `./SKILLs/` 和 `AGENT_SKILLS_DIRS` 指定的目录 |
| 2. 查找文件 | 递归查找所有 `SKILL.md` 文件 |
| 3. 解析 Frontmatter | 提取 YAML 元数据 |
| 4. 提取描述 | 从 Markdown 内容提取描述文本 |
| 5. 生成工具 | 转换为 LangChain DynamicTool |

**SKILL.md 格式示例**：
```markdown
---
name: current-time
description: 获取当前时间
category: utility
tags: [time, system]
---

# Current Time

使用此技能获取当前系统时间...
```

**工具名称规范**：
- 原始技能名：`current-time`
- 规范化：`skill_current_time`

---

#### 3.4.2 types.ts - 技能类型定义

**核心类型**：

| 类型 | 说明 |
|------|------|
| `SkillFrontmatter` | SKILL.md YAML 元数据类型 |
| `SkillMetadata` | 扩展元数据键值对类型 |
| `RegisteredSkill` | 已注册技能的完整信息 |

---

### 3.5 记忆模块 (`src/mem/`)

#### 3.5.1 memory.service.ts - 长期记忆服务

**职责**：与 mem0 服务通信，实现长期记忆的存储和检索

**核心方法**：

| 方法 | 说明 |
|------|------|
| `searchMemories` | 基于语义搜索相关记忆 |
| `addMemory` | 手动添加记忆 |
| `processTurn` | 处理一轮对话，自动提取和存储记忆 |

**mem0 API 端点**：

| 端点 | 用途 |
|------|------|
| `POST /msearch` | 语义搜索 |
| `POST /madd` | 添加记忆 |
| `POST /mprocess` | 处理对话轮次 |

**记忆使用场景**：

```
用户：我儿子叫什么？
↓
检索记忆：["用户儿子叫小明", "用户女儿叫小红"]
↓
注入提示词：[User Profile & Preferences]...
↓
Agent回答：你儿子叫小明。
```

---

### 3.6 工具函数模块 (`src/utils/`)

#### 3.6.1 logger.service.ts - 日志服务

**职责**：提供结构化日志记录，支持 LLM 回调追踪

**功能**：
- 记录 LLM 调用统计（token 数、耗时、模型名）
- 记录记忆操作（检索、存储）
- 通过回调发送 `llm_stats` SSE 事件

---

#### 3.6.2 llm-merge.ts - LLM 配置合并

**职责**：合并多个 LLM 配置来源

**优先级**（高到低）：
1. 请求中的 `context.llm`
2. 环境变量（OPENAI_API_KEY、OPENAI_MODEL_NAME）
3. 默认值

---

#### 3.6.3 history-sanitize.ts - 历史消息净化

**职责**：清理对话历史，确保格式符合 OpenAI API 要求

**处理逻辑**：
- 只保留 `user`、`assistant`、`system` 角色
- 移除未知角色和无效消息
- 截断过长的内容

---

## 4. 文件索引

### 4.1 核心入口文件

| 文件 | 路径 | 职责 |
|------|------|------|
| main.ts | `src/main.ts` | NestJS 应用入口，启动 HTTP 服务器 |
| app.module.ts | `src/app.module.ts` | 根模块定义，注册所有控制器和服务 |

### 4.2 Agent 核心

| 文件 | 路径 | 职责 |
|------|------|------|
| agent.ts | `src/agent/agent.ts` | Agent 工厂，创建 LangGraph Agent |
| tasks-state.ts | `src/agent/tasks-state.ts` | 任务状态管理和提示词注入 |

### 4.3 控制器

| 文件 | 路径 | 职责 |
|------|------|------|
| agent.controller.ts | `src/controller/agent.controller.ts` | Agent 执行和确认端点 |
| health.controller.ts | `src/controller/health.controller.ts` | 健康检查端点 |
| memory.controller.ts | `src/controller/memory.controller.ts` | 记忆管理端点 |
| user.controller.ts | `src/controller/user.controller.ts` | 用户相关端点 |
| avatar.controller.ts | `src/features/avatar/avatar.controller.ts` | 头像服务 |
| skill-proxy.controller.ts | `src/features/skills/skill-proxy.controller.ts` | 技能代理 |

### 4.4 工具

| 文件 | 路径 | 职责 |
|------|------|------|
| java-skills.ts | `src/tools/java-skills.ts` | Java Gateway 工具集合（2200+ 行） |
| manage-tasks.ts | `src/tools/manage-tasks.ts` | 任务管理工具 |
| tool-trace-context.ts | `src/tools/tool-trace-context.ts` | 工具追踪上下文 |

### 4.5 服务

| 文件 | 路径 | 职责 |
|------|------|------|
| memory.service.ts | `src/mem/memory.service.ts` | 长期记忆服务 |
| skill.manager.ts | `src/skills/skill.manager.ts` | 技能发现和管理 |
| logger.service.ts | `src/utils/logger.service.ts` | 日志和追踪服务 |

### 4.6 类型定义

| 文件 | 路径 | 职责 |
|------|------|------|
| types.ts | `src/skills/types.ts` | 技能相关类型定义 |

---

## 5. 开发规范

### 5.1 代码组织原则

1. **单一职责**：每个文件/类只负责一个明确的职责
2. **依赖注入**：使用 NestJS 的 DI 系统，避免硬编码依赖
3. **类型安全**：所有函数参数和返回值都要有类型定义
4. **错误处理**：异步操作必须使用 try-catch，错误要有明确日志
5. **文档注释**：所有公共 API 都要有 JSDoc 注释

### 5.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类 | PascalCase | `AgentController`, `MemoryService` |
| 接口 | PascalCase + I 前缀（可选） | `AgentConfig`, `ITaskState` |
| 函数/方法 | camelCase | `createAgent`, `searchMemories` |
| 常量 | UPPER_SNAKE_CASE | `CONFIRMATION_TIMEOUT_MS` |
| 文件 | kebab-case | `agent.controller.ts`, `memory.service.ts` |
| 环境变量 | UPPER_SNAKE_CASE | `JAVA_GATEWAY_URL` |

### 5.3 注释规范

**文件头注释**（必须）：
```typescript
/**
 * 模块名称
 * 
 * 模块职责：
 * 1. 职责1
 * 2. 职责2
 * 
 * 详细说明...
 * 
 * @module 模块名
 * @author 作者
 * @since 版本
 */
```

**函数注释**（公共 API 必须）：
```typescript
/**
 * 函数描述
 * 
 * @param param1 - 参数1说明
 * @param param2 - 参数2说明
 * @returns 返回值说明
 * @throws 可能抛出的异常
 * @example 使用示例
 */
```

---

## 6. 环境变量参考

### 6.1 服务配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | HTTP 服务端口 |
| `HOST` | 0.0.0.0 | HTTP 服务监听地址 |

### 6.2 Java Gateway 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JAVA_GATEWAY_URL` | http://localhost:18080 | Java Skill Gateway 地址 |
| `JAVA_GATEWAY_TOKEN` | - | Gateway 认证令牌 |

### 6.3 LLM 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENAI_API_KEY` | - | OpenAI API Key |
| `OPENAI_MODEL_NAME` | gpt-4 | 默认模型名称 |
| `OPENAI_API_BASE` | - | 自定义 OpenAI 兼容服务地址 |

### 6.4 技能配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_SKILLS_DIRS` | - | 额外的技能目录（逗号分隔） |
| `AGENT_BUILTIN_SKILL_DISPATCH` | legacy | 内置技能路由模式（legacy/gateway） |
| `AGENT_EXPOSE_SSH_EXECUTOR` | false | 是否暴露 SSH 执行器 |

### 6.5 记忆配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MEM0_URL` | http://39.104.81.41:8001 | mem0 服务地址 |
| `MEM0_ENABLED` | true | 是否启用长期记忆 |

### 6.6 日志配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_RAW_LOG` | false | 是否记录原始 LLM 请求/响应 |
| `AGENT_RUN_RAW_LOG` | false | 是否记录 Agent 执行原始数据 |

---

## 附录

### A. 相关文档

- `readme.md` - 版本说明
- `DEPLOY.md` - 部署指南（离线服务器）
- `src/skills/README.md` - 技能集成文档
- `.env.example` - 环境变量示例

### B. 常用命令

```bash
# 安装依赖
npm install

# 开发模式
npm run start:dev

# 生产构建
npm run build

# 生产运行
npm run start:prod

# 运行测试
npm test
```

### C. 调试技巧

1. **启用原始日志**：设置 `LLM_RAW_LOG=true` 查看完整 LLM 请求/响应
2. **查看 SSE 流**：使用浏览器开发者工具或 `curl` 查看 SSE 事件流
3. **检查记忆**：调用 `POST /memory/add` 和查看控制台日志确认记忆服务正常工作
4. **追踪工具调用**：查看 `tool_trace` SSE 事件了解工具执行详情

---

**文档版本**: 1.0.0  
**最后更新**: 2024年  
**维护团队**: Agent Core Team
