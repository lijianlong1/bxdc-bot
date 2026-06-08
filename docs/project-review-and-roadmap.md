# Fishtank (BXDC.bot) 项目综合诊断与演进方案报告

> 基于对全部 50+ 份 specs、30+ 个核心源文件、20+ 份设计文档的完整分析
> 生成日期：2026-05-26

---

## 一、项目现状总览

### 1.1 架构现状

项目当前实际为 **三层直连架构**，而非 docs/refactor-guides 中描绘的理想化"统一入口"架构：

```
前端(Vue3)→ Skill Gateway(Java)→ Agent Core(NestJS)→ LLM/Mem0
                ↑                        ↑
                └──── Skill 工具回调 ──────┘
```

与 [设计初衷](file:///Users/yangkai/Desktop/fishtank/docs/ARCHITECTURE.md) 的"轻 Agent、重 Skill"一致，但在实现上存在若干偏差。

### 1.2 模块现状矩阵

| 模块 | 技术栈 | 行数规模 | 当前状态 |
|------|--------|---------|---------|
| **Agent Core** | NestJS + LangGraph.js | ~5000 行 | 承担了 Skill 注册、参数校验(Ajv+Zod)、SSH 危险命令判断、确认流、OPENCLAW 编排等**大量执行逻辑** |
| **Skill Gateway** | Spring Boot + JPA + MySQL | ~4000 行 | 主要做 CRUD + HTTP 代理 + SSH 执行 + 审计落库 |
| **Frontend** | Vue3 + TDesign | ~4000 行 | 聊天 UI、Skill Hub、台账管理、参数确认表单 |

### 1.3 当前 Skill 体系全景

```
Skill 体系
├── 文件系统 Skill（SKILL.md） ← SkillManager 管理，路径硬编码
│   └── 示例：./SKILLs/hello-world/SKILL.md
├── 数据库扩展 Skill（skills 表） ← 从 Gateway 动态加载
│   ├── CONFIG 模式
│   │   ├── kind=api → executeConfiguredApiSkill (Ajv校验 → Gateway代理)
│   │   ├── kind=ssh → executeServerResourceStatusSkill (台账解析 → Gateway SSH)
│   │   └── kind=template → 返回 prompt 文本
│   └── OPENCLAW 模式 → executeOpenClawSkill (受限工具集子规划)
└── 内置 Tool（代码硬编码）
    ├── skill_generator（内置 Skill 生成器）
    ├── compute（内置计算器）
    ├── ssh_executor（条件暴露）
    ├── api_caller（已暂停默认注册）
    ├── linux_script_executor
    ├── server_lookup
    └── manage_tasks
```

---

## 二、设计初衷 vs 现状差距分析

### 2.1 核心初衷回顾

从 [ARCHITECTURE.md](file:///Users/yangkai/Desktop/fishtank/docs/ARCHITECTURE.md) 到 [platform-requirements.md](file:///Users/yangkai/Desktop/fishtank/docs/platform-requirements.md)，核心设计理念一致：

> **"轻 Agent，重 Skill 和 MCP 能力"**——Agent 只负责制定计划、选择调用工具、查看分析执行结果；能力扩展靠对接各类 MCP / Tool。

### 2.2 做到了什么（✅）

| 设计目标 | 实现情况 | 依据 |
|---------|---------|------|
| Agent 基于 ReAct 循环 | ✅ | `agent.ts` 使用 `createReactAgent` |
| 扩展 Skill 动态加载 | ✅ | `java-skills.ts` `loadGatewayExtendedTools` 从 Gateway 拉取并注册 `DynamicStructuredTool` |
| 结构化参数校验 | ✅ | Ajv + Zod 双重校验，参数确认表单支持 enum/enumSource |
| 确认流机制 | ✅ | `agent.controller.ts` LangGraph interrupt/Command |
| 审计日志体系 | ✅ | 四表架构（audit_logs, llm_http_audit_logs, gateway_outbound_audit_logs, skill_ssh_invocation_audit_logs） |
| 用户隔离 | ✅ | 记忆隔离、台账隔离、Skill 可见性（PUBLIC/PRIVATE） |
| OPENCLAW 自主规划 | ✅ | `agent-skill-execution-flows.md` 完整的子规划 + 工具白名单 |

### 2.3 没有做到什么（❌/⚠️）

#### 2.3.1 Agent 过重——承担了过多执行逻辑

Agent Core 当前不仅是"推理编排层"，更是一个 **执行引擎**。核心问题聚集在 [java-skills.ts](file:///Users/yangkai/Desktop/fishtank/backend/agent-core/src/tools/java-skills.ts)——该文件近 2800 行，包含了：

| 在 Agent Core 中实现的功能 | 应该在哪 | 行数估算 |
|--------------------------|---------|---------|
| API Skill 参数合并与拼接 (URL/query/body) | Gateway | ~400 行 |
| JSON Schema 校验 (Ajv compile/validate) | Gateway | ~150 行 |
| ParameterBinding 路由 (query/jsonBody/formBody) | Gateway | ~200 行 |
| SSH 危险命令判断 | Gateway | ~80 行 |
| 异步轮询逻辑 (asyncPoll) | Gateway | ~300 行 |
| OPENCLAW 子规划 (bindTools + invokeToolDirect) | Agent Core（合理） | ~500 行 |
| 确认门逻辑 (applyExtendedSkillConfirmationGate) | Agent Core（合理） | ~100 行 |

**结论**：约 **55% 的执行逻辑**（参数处理、HTTP 组装、异步轮询）应该在 Gateway 侧完成，而非在 Agent Core。

#### 2.3.2 Skill 概念非标准化

当前"Skill"是一个**内部自定义概念**，并未遵循业界标准：

| 方面 | 当前做法 | 标准做法 |
|------|---------|---------|
| Skill 定义格式 | 自定义 JSON（`configuration` 字段随 `kind` 变化） | 无统一 schema |
| Skill 发现机制 | `GET /api/skills` 自定义 API | MCP `tools/list` 或 Skill 标准协议 |
| Tool 调用协议 | 自定义 `POST /api/skills/{id}/execute` | MCP `tools/call` 或 Function Calling 标准 |
| 参数格式 | 自定义 JSON Schema + `parameterContract` | OpenAPI/JSON Schema（已有但未与外界对齐） |
| 文件系统 Skill | 私有 `SKILL.md` + YAML frontmatter | Claude Code 的 SKILL.md 格式（参考性，非正式标准） |

#### 2.3.3 MCP 概念仅是名义上的

项目没有任何 MCP 协议实现——没有 `tools/list`、`tools/call`、`resources/read`、`prompts/get` 等 MCP 标准端点。当前"对接 MCP"的设想仅停留在架构文档的描述层面。

#### 2.3.4 耦合问题——"改 Skill 必须改 Agent"

当前架构下，新增一类 Skill 执行模式的典型路径是：

1. 在 Agent Core 的 [java-skills.ts](file:///Users/yangkai/Desktop/fishtank/backend/agent-core/src/tools/java-skills.ts) 中增加新的 `execute*Skill` 函数
2. 在 Skill Gateway 增加对应代理端点
3. 两边需要协调字段格式

这意味着 **Agent Core 和 Skill Gateway 之间存在隐式的、非契约化的耦合**。理想情况下，Agent Core 只需要知道"有哪些工具"和"怎么调用工具"，而工具的**执行逻辑**应完全在 Gateway 侧。

#### 2.3.5 日志体系碎片化

| 日志类型 | 位置 | 触发方式 |
|---------|------|---------|
| agentRun.log | Agent Core 本地文件 | 环境变量 `AGENT_RUN_RAW_LOG` |
| llmOrg.log | Agent Core 本地文件 | 环境变量 `LLM_RAW_HTTP_LOG` |
| llm_http_audit_logs | MySQL（经 Gateway） | 环境变量 `LLM_ORG_LOG_REMOTE` |
| audit_logs | MySQL（Gateway 本地） | AOP 切面 |
| gateway_outbound_audit_logs | MySQL（Gateway 本地） | Gateway 出站拦截 |
| skill_ssh_invocation_audit_logs | MySQL（Gateway 本地） | SSH 执行拦截 |

**问题**：六条日志链路互不统属，格式不统一，排查问题时需要跨多个系统拼接。

---

## 三、标准化 MCP 和 Skill 方案接入分析

### 3.1 MCP (Model Context Protocol) 标准化接入

[MCP](https://modelcontextprotocol.io/) 是 Anthropic 推出的 LLM-工具交互标准协议，核心概念与当前项目的 Skill 体系高度对齐：

| MCP 概念 | 当前项目对应 | 差距 |
|---------|------------|------|
| **Tool** | 内置 Tool + 扩展 Skill | 当前 Tool 的定义和调用都是自定义格式 |
| `tools/list` | `GET /api/skills` + `GET /api/system-skills/agent` | 返回格式不同，需适配 |
| `tools/call` | `POST /api/skills/{id}/execute` 等 | 参数格式不同，需统一 |
| **Resource** | 无明确对应 | 可映射为文件配置等 |
| **Prompt** | OPENCLAW systemPrompt / SKILL.md | 格式不同 |
| Transport (stdio/SSE) | HTTP + SSE | 传输层已就绪，需适配 |

#### 3.1.1 推荐改造方案：Gateway 作为 MCP Server

```
┌──────────────┐    MCP over HTTP/SSE    ┌──────────────────┐
│  Agent Core  │ ◄──────────────────────► │  Skill Gateway   │
│  (MCP Client)│    tools/list            │  (MCP Server)    │
│              │    tools/call            │                  │
│              │    resources/read        │  ┌────────────┐  │
│              │    prompts/get           │  │ Skill 执行器 │  │
│              │                          │  │ API/SSH/... │  │
│              │                          │  └────────────┘  │
└──────────────┘                          └──────────────────┘
```

**改造要点**：

1. Gateway 新增 MCP 端点：`/mcp/tools/list`、`/mcp/tools/call`、`/mcp/resources/read`、`/mcp/prompts/get`
2. Agent Core 内置一个 MCP Client，替代当前的 `loadGatewayExtendedTools` + 自定义 `DynamicStructuredTool`
3. 内置 Tool（compute、manage_tasks 等）也注册进 MCP Server，实现真正的"所有工具都从 MCP 来"
4. 保留 SSE transport，兼容当前流式架构

**收益**：
- Agent 只做 ReAct 循环 + MCP Client 调用，不关心工具内部实现
- 新增任何 Tool 只需在 Gateway 注册，Agent 自动发现
- 可接入第三方 MCP Server（未来扩展）

### 3.2 Skill 标准化方案

#### 3.2.1 文件系统 Skill：保留 SKILL.md，但加入标准语义

当前 SKILL.md 格式与 Claude Code、Cursor 等工具兼容。建议：

1. **保留** YAML frontmatter + Markdown 体格式
2. **增加** 标准化的 `tools` 声明（声明此 Skill 依赖哪些 Tool）
3. **通过 MCP prompts/get** 暴露，而非直接拼接 prompt

#### 3.2.2 数据库 Skill：迁移到 MCP Tool 模型

当前 `skills` 表的 `configuration` JSON 字段随 `kind` 变化。建议：

1. 定义统一的 `SkillDefinition` Schema（参考 OpenAPI / JSON Schema 标准）
2. `parameterContract` 保留 JSON Schema 格式（已符合标准）
3. 通过 MCP `tools/list` 返回，`tools/call` 执行
4. 将参数校验、HTTP 组装、异步轮询等逻辑从 Agent Core 移至 Gateway

---

## 四、问题治理与后续需求方案

### 4.1 当前问题清单与治理方案

| 问题 | 根因 | 治理方案 | 优先级 |
|------|------|---------|--------|
| Agent Core 过重 | 执行逻辑下沉不足 | 将 API/SSH/template Skill 的参数处理、校验、HTTP 组装移入 Gateway | **P0** |
| 日志碎片化 | 多条独立的日志链路 | 统一日志 SDK → Gateway → 单一落库表 | **P0** |
| Skill 表单复杂 | parameterContract 裸露给用户 | 保持现状（已有 AI 优化 + enumSource 支持），后续可加模板化 | P1 |
| 耦合度高 | 缺乏标准化 Tool 协议 | 实施 MCP，Gateway 作为 Tool Provider | **P0** |
| 潜在效率问题 | 串行调用、无缓存 | MCP 协议支持批量调用；Gateway 内 Skill 配置缓存 | P1 |

### 4.2 未来需求与承载方案

| 需求 | 承载方式 | 说明 |
|------|---------|------|
| **Plan 模式** | Agent Core 增强 | Plan 是一种 Agent 行为模式，应在 Agent 层实现，通过 `manage_tasks` 持久化计划状态 |
| **文件上传** | Gateway + Agent Core | 文件作为 MCP Resource 或临时上下文，Gateway 负责存储，Agent 引用 |
| **单/多对话并行** | Gateway Conversation 管理 | Gateway 已有 MySQL 表设计基础，需实现多 session 并行调度 |
| **数据库操作** | Gateway 新增 Tool | 作为 MCP Tool 暴露（如 `db_query`），Gateway 内部实现安全校验 |
| **代码执行** | Gateway 沙箱 Tool | 作为 MCP Tool 暴露（如 `code_execute`），在 Gateway 沙箱中执行 |
| **浏览器访问** | Gateway 或独立 MCP Server | 作为 MCP Tool 或独立 MCP Server（如 Playwright MCP）接入 |
| **Agent 查询执行日志** | Gateway 日志查询 API | 作为 MCP Tool 或 Resource 暴露给 Agent |

### 4.3 推荐的目标架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Vue3)                           │
│                  用户交互 · 聊天 · 确认 · 配置                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTP/SSE (唯一入口)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Skill Gateway (Spring Boot)                    │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  MCP Server  │  │ 会话/用户    │  │   执行引擎                │ │
│  │  tools/list  │  │ Conversation│  │   API 代理 · SSH · 计算   │ │
│  │  tools/call  │  │ User/台账   │  │   模板 · 代码执行(新)     │ │
│  │  resources/* │  │ LLM设置     │  │   浏览器(新) · DB(新)    │ │
│  │  prompts/*   │  │             │  │                          │ │
│  └──────┬───────┘  └─────────────┘  └──────────────────────────┘ │
│         │                                                        │
│         │             ┌────────────────┐                        │
│         └─────────────┤  统一日志模块   │                        │
│                       │  (单表落库)     │                        │
│                       └────────────────┘                        │
└──────────────────────────────┬───────────────────────────────────┘
                               │ MCP (HTTP/SSE)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Agent Core (NestJS)                            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ ReAct 引擎    │  │ MCP Client   │  │ 确认流 / interrupt     │ │
│  │ (plan/think)  │  │ (发现+调用)  │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                  │
│  注意：不再包含 Skill 执行逻辑、参数校验、HTTP 组装                │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      第三方 MCP Server (可选)                     │
│              浏览器 · 数据库 · 文件系统 · 代码执行                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 实施路线图

```
Phase 0 (当前-2周): 现状梳理、MCP 方案设计
  ├── 输出本报告
  └── 确定 MCP 协议适配方案

Phase 1 (2-6周): 核心解耦
  ├── Gateway 实现 MCP Server (tools/list, tools/call)
  ├── Agent Core 内置 MCP Client，替代 loadGatewayExtendedTools
  ├── 将 API Skill 参数处理逻辑从 Agent Core 移入 Gateway
  └── 日志统一方案实施

Phase 2 (6-10周): Skill 标准化
  ├── 内置 Tool 全部迁移到 MCP 协议
  ├── SKILL.md 保留 + MCP prompts/get 接入
  └── Skill 配置 Schema 标准化

Phase 3 (10-16周): 能力扩展
  ├── Plan 模式 (Agent 增强)
  ├── 文件上传 (MCP Resource)
  ├── 数据库操作 Tool (Gateway)
  ├── 代码执行 Tool (Gateway 沙箱)
  ├── 浏览器访问 Tool (MCP Server)
  └── Agent 日志查询 (MCP Resource/Tool)

Phase 4 (16-20周): 多会话与性能
  ├── 多对话并行调度
  ├── 批量工具调用
  └── Skill 配置缓存优化
```

---

## 五、总结

### 5.1 核心诊断

当前项目在功能层面已实现了一个**完整的 AI Agent 对话平台**，包含 Skill 体系、自主规划、确认流、审计日志、用户隔离等企业级能力。设计初衷（轻 Agent、重 Skill）方向正确，但在实现上出现了 **Agent Core 过载**——约 55% 的执行逻辑滞留在 Agent 层，导致"改 Skill 就要改 Agent"的耦合问题。

### 5.2 核心建议（三条）

1. **引入 MCP 协议**：以 Gateway 为 MCP Server、Agent Core 为 MCP Client，标准化 Tool 的发现与调用。这是解决"Agent 与 Skill 耦合"的一号工程，也是对接第三方 Tool 的基础设施。

2. **执行逻辑下沉**：将 `java-skills.ts` 中约 1100 行的参数处理/HTTP 组装/校验代码移至 Gateway，使 Agent Core 回归纯粹的 ReAct 编排。

3. **日志统一**：合并当前 6 条日志链路为单一事件总线（统一格式 → Gateway → 统一表结构），降低排障成本。

### 5.3 不可动摇的原则

- **Agent 不持有敏感凭证**（已做到，需保持）
- **所有副作用操作由 Gateway 执行**（部分未做到，需整改）
- **Skill 是平台能力的唯一扩展方式**（方向正确，需标准化）
