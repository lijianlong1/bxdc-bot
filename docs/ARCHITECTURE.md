# Fishtank (BXDC.bot) 项目架构说明

## 1. 项目概述

Fishtank（原名 BXDC.bot）是一个支持多用户、多会话的企业级 Agent-bot 平台。采用 **"Thin Agent, Thick Tools"（瘦 Agent，胖工具）** 架构模式，实现 Agent 自动调用存量 Skill 完成任务分析、执行与监控。

### 1.1 核心目标

- **多用户支持**：C/S 架构，支持多用户并发使用
- **混合架构**：结合 Java Web 的业务优势与 Node.js/LangGraph 的 Agent 编排能力
- **安全运维**：提供安全的远程 SSH 执行和 API 调用，敏感凭证不泄露给 Agent
- **全链路审计**：记录 Agent 思考过程与实际执行操作

---

## 2. 整体架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vue 3 SPA)                                 │
│                         Port: 5173 (Vite dev)                                │
│  - 聊天界面 (TDesign Chat)  - 用户认证  - 任务提交  - SSE 事件订阅            │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ HTTP POST /api/tasks
                                 │ EventSource /api/tasks/{id}/events
                                 │ Auth: /api/auth/*, /api/user/*
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SKILL GATEWAY (Spring Boot)                               │
│                    Port: 18080                                               │
│  - API 网关  - 任务调度  - 权限控制  - Skill 执行  - 审计日志  - SSE 转发      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ HTTP POST /agent/run (SSE 响应)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AGENT CORE (NestJS)                                     │
│                      Port: 3000                                              │
│  - LangGraph ReAct Agent  - 记忆管理  - Tool 封装  - 流式输出                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 分层职责

| 层级 | 组件 | 职责 |
|------|------|------|
| **表现层** | Frontend | 用户交互、聊天 UI、任务提交、SSE 订阅 |
| **业务控制层** | Skill Gateway | API 网关、权限、任务调度、Skill 执行、审计 |
| **智能编排层** | Agent Core | 推理规划、工具调用、记忆管理、流式输出 |

---

## 3. 目录结构

```
fishtank/
├── .cursor/                    # Cursor IDE 规则与技能 (OpenSpec 工作流)
├── frontend/                   # Vue 3 前端应用
├── frontend-react-backup/      # 旧版 React 前端备份
├── backend/
│   ├── agent-core/            # NestJS + LangGraph Agent 服务
│   ├── skill-gateway/         # Spring Boot Java 网关
│   └── doc/                   # 技术设计文档
├── openspec/                   # OpenSpec 规范与变更提案
│   ├── specs/                 # 功能规格说明
│   └── changes/               # 变更提案 (进行中/已归档)
├── docs/                      # 项目文档
└── README.md
```

---

## 4. 模块详解

### 4.1 Frontend（前端）

**技术栈**：Vue 3、Vite 7、TypeScript、TDesign Vue Next、Tailwind CSS、Vue Router、markdown-it

**主要功能**：
- 聊天界面：基于 `@tdesign-vue-next/chat` 的对话 UI
- 用户认证：登录、注册、个人资料
- 任务管理：创建任务、订阅 SSE 事件流
- Markdown 渲染：消息内容展示

**关键文件**：
- `src/views/ChatView.vue` - 主聊天视图
- `src/composables/useChat.ts` - 聊天逻辑
- `src/composables/useUser.ts` - 用户状态
- `src/services/api.ts` - API 调用（`VITE_API_URL` 默认 `http://localhost:18080`）

**API 对接**：
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/{id}/events` - SSE 事件流
- `/api/auth/*`、`/api/user/*` - 认证与用户接口

---

### 4.2 Skill Gateway（技能网关）

**技术栈**：Spring Boot 3.2、Java 17、Spring Security、Spring Data JPA、MySQL、SSHJ、WebFlux、Lombok

**职责**：
- **API 网关**：暴露 REST 接口供 Agent 调用
- **安全中心**：管理 SSH 密钥、API Token，细粒度权限校验
- **执行引擎**：执行 SSH 命令、HTTP 请求等副作用操作
- **任务调度**：接收用户请求，分发给 Agent Core，处理流式反馈
- **审计日志**：通过 AOP 记录所有 Skill 调用

**核心组件**：
- `TaskController` - 任务创建与 SSE 事件
- `SkillController` - SSH、API、Compute 等 Skill 执行
- `AuthController` / `UserController` - 认证与用户
- `TaskDispatcherService` - 任务分发至 Agent Core
- `AgentStreamConsumer` - 消费 Agent SSE 并转发
- `SSHExecutorService` - SSH 远程执行
- `ApiProxyService` - HTTP API 代理
- `AuditAspect` - 审计切面

**数据库**：**MySQL**（运行时关系库；JPA `ddl-auto` + `schema.sql` 补充迁移）。配置与参考建表见 `docs/skill-gateway-mysql.md`。

---

### 4.3 Agent Core（Agent 核心）

**技术栈**：NestJS 10、LangGraph.js、LangChain.js、OpenAI、better-sqlite3、Axios、RxJS

**职责**：
- **推理编排**：基于 LangGraph.js 构建 ReAct Agent，规划任务执行路径
- **工具封装**：将 Skill Gateway 的 API 封装为 LangChain Tool
- **流式输出**：通过 SSE 实时推送思考过程与执行结果
- **记忆管理**：用户级记忆存储与检索

**核心组件**：
- `AgentController` - 接收任务、运行 Agent、返回 SSE
- `MemoryController` - 记忆 CRUD
- `UserController` / `AvatarController` - 用户与头像
- `createReactAgent` - LangGraph ReAct Agent
- `JavaSshTool`、`JavaApiTool`、`JavaComputeTool` - 调用 Skill Gateway
- `MemoryService`、`coworkMemoryManager`、`coworkMemoryJudge`、`coworkMemoryExtractor` - 记忆系统
- `SkillManager` - YAML 技能定义管理

**图状态（Graph State）**：

Agent 使用 `createReactAgent` 的 `stateSchema` 扩展了默认 `MessagesAnnotation`，增加了 `tasks_status` 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | `BaseMessage[]` | 标准对话消息（由 LangGraph 内置 reducer 管理） |
| `tasks_status` | `Record<string, TaskState>` | 会话内任务完成状态映射（merge reducer） |

其中 `TaskState = { label: string, status: 'pending' \| 'in_progress' \| 'completed' \| 'cancelled', updatedAt: string }`。

**任务状态流转**：
1. `preModelHook`：每次 LLM 调用前，从消息历史中的 `manage_tasks` 工具调用重建 `tasks_status`，并将摘要注入到 LLM 输入消息中
2. `manage_tasks` 工具：LLM 通过该工具注册新任务或更新任务状态
3. 条件路由：当前依赖 prompt 引导 LLM 跳过已完成任务，无自定义条件边

**关键文件**：
- `src/agent/tasks-state.ts` - 状态类型定义、Annotation、preModelHook
- `src/tools/manage-tasks.ts` - 任务管理工具
- `test/tasks-state.test.cjs` - 任务状态集成测试

**数据库**：SQLite（`memories.db`，用于记忆存储）

**环境变量**：`JAVA_GATEWAY_URL`（默认 `http://localhost:18080`）

**LLM 对接**：经 LangChain `ChatOpenAI` 访问 OpenAI 兼容 Chat Completions；`messages` 使用标准 `role`（`system`、`user`、`assistant`、`tool` 等）。Agent Core 不对出站 HTTP 请求体做 role 改写，上游须为标准兼容实现。可选 `LLM_RAW_HTTP_LOG` 将请求/响应写入 `logs/llmOrg.log`，内容与实际上发报文一致。可选 `LLM_ORG_LOG_REMOTE` 将同等记录经 HTTP 发往 skill-gateway 落库（`llm_http_audit_logs`），**不**经 agent-core 直连数据库。

---

## 5. 数据流与通信

### 5.1 任务执行流程

1. **任务提交**：Frontend → `POST /api/tasks` (Skill Gateway) → 返回 `taskId`
2. **SSE 订阅**：Frontend → `GET /api/tasks/{id}/events` (Skill Gateway) → 建立 SSE 连接
3. **任务执行**：Skill Gateway → `POST /agent/run` (Agent Core) → Agent 执行 ReAct 循环
4. **Skill 调用**：Agent Core → `POST /api/skills/ssh`、`/api/skills/api`、`/api/skills/compute` (Skill Gateway)
5. **流式转发**：Agent Core 发出 SSE → Skill Gateway 转发 → Frontend

### 5.2 通信协议

| 方向 | 协议 | 说明 |
|------|------|------|
| Java → Node.js | HTTP POST | 下发任务指令 |
| Node.js → Java | HTTP POST | 调用 Skill 接口 |
| Node.js → Java | SSE | 流式回传执行状态（Agent 运行结果） |
| Java → Frontend | SSE | 转发 Agent 事件流 |

---

## 6. 技术选型汇总

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | Vue 3、Vite 7、TypeScript | SPA 框架与构建 |
| | TDesign Vue Next | UI 组件库 |
| | Tailwind CSS | 样式 |
| | markdown-it | Markdown 渲染 |
| **网关** | Spring Boot 3.2、Java 17 | Web 框架 |
| | Spring Security | 认证授权 |
| | Spring Data JPA | ORM |
| | SSHJ | SSH 客户端 |
| | MySQL | 数据库 |
| **Agent** | NestJS 10 | Web 框架 |
| | LangGraph.js、LangChain.js | Agent 编排 |
| | OpenAI | LLM |
| | better-sqlite3 | 记忆存储 |

---

## 7. 配置与运行

### 7.1 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 5173 | Vite 开发服务器 |
| Skill Gateway | 18080 | API 网关 |
| Agent Core | 3000 | Agent 服务 |

### 7.2 关键配置

| 配置项 | 位置 | 默认值 |
|--------|------|--------|
| `VITE_API_URL` | frontend | `http://localhost:18080` |
| `JAVA_GATEWAY_URL` | agent-core | `http://localhost:18080` |
| Agent URL | skill-gateway TaskDispatcherService | `http://localhost:3000` |

### 7.3 启动顺序

1. 启动 Skill Gateway：`cd backend/skill-gateway && mvn spring-boot:run`
2. 启动 Agent Core：`cd backend/agent-core && npm run start:dev`
3. 启动 Frontend：`cd frontend && npm run dev`

---

## 8. 架构优势

- **扬长避短**：Java 负责企业级业务与权限，Node.js 负责 AI Agent 编排
- **安全性高**：Agent 不持有敏感凭证，仅使用临时任务 Token；高危操作可在 Java 层拦截
- **可维护性**：业务逻辑与智能逻辑分离，升级 SSH 库或优化 Prompt 互不影响
- **可扩展性**：新增 Skill 只需在 Java 层实现并暴露接口，Agent 层注册对应 Tool

---

## 9. 相关文档

- `backend/doc/technical-design.md` - 技术方案详细说明
- `openspec/specs/` - 功能规格（API Gateway、Agent Client、Memory 等）
- `openspec/changes/` - 变更提案与任务分解
