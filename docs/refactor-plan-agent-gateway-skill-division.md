# Agent Core 与 Skill Gateway 职责重划分方案

> 范围：Skill 请求处理链路上 Agent 与 Gateway 的分工重新划分
> 不涉及：MCP 协议标准化、Skill 定义格式标准化（暂缓）
> 生成日期：2026-05-26

---

## 一、总原则

| 层级 | 职责 | 不做什么 |
|------|------|---------|
| **Agent Core** | 推理编排：填参校验、确认等待、拿到结果继续思考 | 不拼 HTTP 请求、不读执行配置决定怎么执行、不知道工具内部实现 |
| **Skill Gateway** | 工具执行：拼 HTTP、连数据库、跑代码、开浏览器、判断是否需要确认、执行异步轮询 | 不做 LLM 推理 |

一句话：**Agent 传 `{ skillId, parameters }`，Gateway 返回结果。中间的一切是 Gateway 的事。**

---

## 二、参数处理

### 2.1 当前状态

Agent Core 的 [java-skills.ts](file:///Users/yangkai/Desktop/fishtank/backend/agent-core/src/tools/java-skills.ts) 负责完整的参数处理链路：

```
LLM填参 → 归一(normalizeApiSkillPayload) → 收集默认值 → 合并 → Ajv校验 → 拼URL/Header/Body → 发Gateway
```

### 2.2 改造后分工

| 环节 | 放在哪 | 理由 |
|------|--------|------|
| 收集默认值 + 合并 `{ ...defaults, ...LLM提供的值 }` | Agent | 默认值来自 `parameterContract`，Schema 已在 Agent 侧（用于生成 Zod、做 Ajv 校验） |
| Ajv/Zod 校验完整参数 | Agent | 紧致纠错循环：校验失败立即返回结构化错误给 LLM，LLM 在同轮对话中重填参数 |
| 拼 URL query / headers / body | **Gateway** | 纯执行逻辑，Agent 不该知道 HTTP 细节 |
| `parameterBinding` 路由 (query/jsonBody/formBody) | **Gateway** | 新增绑定方式只改 Gateway |

### 2.3 Agent 传给 Gateway 的格式

```json
POST /api/skills/execute
{
  "skillId": 42,
  "parameters": {
    "env": "dev",
    "serverId": "srv-01",
    "action": "status",
    "pageSize": 20
  }
}
```

`parameters` 是已经合并了默认值的完整参数对象。Gateway 拿到后自己读 Skill 配置，决定怎么执行。

---

## 三、执行分派

### 3.1 当前状态

[java-skills.ts](file:///Users/yangkai/Desktop/fishtank/backend/agent-core/src/tools/java-skills.ts) 的 `DynamicStructuredTool.func` 内部有一组硬编码的分支：

```typescript
// 当前：Agent Core 根据 kind 决定执行路径
if (kind === 'api')            → executeConfiguredApiSkill()
if (kind === 'ssh' && preset)  → executeServerResourceStatusSkill()
if (kind === 'template')       → 返回 prompt 文本
if (executionMode === 'OPENCLAW') → executeOpenClawSkill()
```

新增一个执行类型（如 `db_query`），必须在 Agent 加新分支 + Gateway 加端点，改两边。

### 3.2 改造后

Agent 只调一个统一端点，不再有 kind 分支：

```typescript
// 改造后：Agent 不知道 kind，只知道"调工具"
const result = await axios.post(gatewayUrl + '/api/skills/execute', {
  skillId,
  parameters: validatedArgs,
});
return result.data;
```

Gateway 内部根据 Skill 配置决定执行方式：

```
Gateway: POST /api/skills/execute { skillId, parameters }
  → 读 skills 表 → kind=api → 拼 HTTP → 代理出站
  → 读 skills 表 → kind=ssh → 台账解析 → SSH 执行
  → 读 skills 表 → kind=template → 返回 prompt
  → 读 skills 表 → kind=db_query(新) → 执行 SQL
```

**收益**：新增任何执行能力，只改 Gateway，Agent 零改动。

---

## 四、确认流

### 4.1 当前状态

Agent Core 读 Skill 配置中的 `requiresConfirmation` 字段，自己判断是否需要确认，触发 LangGraph interrupt。

问题：撇开 Agent 直接调 Gateway 的执行接口，确认门不存在，该确认的操作直接执行了。

### 4.2 改造后

| 环节 | 放在哪 | 理由 |
|------|--------|------|
| 判断是否需要确认 | **Gateway** | 执行侧的安全约束由执行方自己守，不依赖调用方自觉 |
| 存储确认状态（requestId → 参数） | **Gateway**（内存 ConcurrentHashMap） | 单机部署够用，过期自动清理 |
| interrupt + SSE + 等待用户操作 | Agent | 发挥 LangGraph checkpoint 持久化优势，进程重启可恢复 |
| 用户确认后重新调 Gateway 执行 | Agent → Gateway | 两次都是短连接 |

### 4.3 完整流程（两步短连接）

**第一步：**
```
Agent: POST /api/skills/execute { skillId, parameters }
  → Gateway: 读配置 → requiresConfirmation = true → 不执行
  → Gateway: 存 (requestId → { skillId, parameters, userId, expiresAt })
  → Gateway: 秒回 { status: "CONFIRMATION_REQUIRED", requestId, skillName, summary, parameters, expiresInSeconds }
  → Agent: 收到 CONFIRMATION_REQUIRED → LangGraph interrupt → SSE 推给前端
```

**第二步：**
```
用户操作确认表单 → 前端 POST /agent/confirm { confirmed: true, adjustedParams }
  → Agent: LangGraph resume
  → Agent: POST /api/skills/execute { skillId, parameters, confirmed: true, requestId }
  → Gateway: 校验 requestId（存在 + 未过期 + 用户匹配）
  → Gateway: 用 adjustedParams 覆盖原参数 → 执行 → 返回结果 → 删除 requestId
```

Gateway 从头到尾不挂连接等人，两次调用都是短连接。

---

## 五、异步轮询

### 5.1 当前状态

Agent Core 的 [java-skills.ts](file:///Users/yangkai/Desktop/fishtank/backend/agent-core/src/tools/java-skills.ts) `executeConfiguredApiSkillAsync` 函数：

1. 解析 `asyncPoll` 配置
2. 拼 HTTP 请求 + asyncPoll 配置 → POST `/api/skills/api/async`
3. 拿到 `asyncTaskId` 后 → 长轮询 GET `/async-tasks/{id}/wait` 等结果
4. 发审计日志

Gateway 负责真正的轮询引擎（Scheduler 定时调度 + 状态评估）。

### 5.2 改造后

Gateway 内部完成全部异步轮询流程，Agent 无感知：

```
Agent: POST /api/skills/execute { skillId, parameters }
  → Gateway: 读 Skill 配置 → 发现有 asyncPoll
  → Gateway: 发起初始 API 请求 → 提取外部 taskId
  → Gateway: [Scheduler 定时轮询外部 API]
  → Gateway: 等到 COMPLETED/FAILED/TIMEOUT
  → Gateway: 返回结果

Agent: 毫不知情这是一次异步轮询，只看到调工具等了几十秒拿回结果
```

Agent 删除的代码：`executeConfiguredApiSkillAsync`（约 170 行）+ `postPollingAudit`（约 40 行）+ 分派分支。

---

## 六、前端 Skill 配置页

### 6.1 当前状态

`SkillManagementModal.vue` 中三种执行类型（api/ssh/template）各自硬编码一套表单组件。新增类型需要改前端。

### 6.2 改造后

Gateway 暴露 `GET /api/system-skills/execution-types`，返回所有类型的配置 Schema：

```json
[
  {
    "type": "api",
    "label": "API 调用",
    "configSchema": {
      "type": "object",
      "properties": {
        "method": {
          "type": "string", "enum": ["GET","POST","PUT","DELETE"],
          "label": "请求方法", "required": true, "ui": "select"
        },
        "endpoint": {
          "type": "string",
          "label": "请求地址", "required": true, "ui": "input",
          "placeholder": "https://api.example.com/...",
          "aiHint": "完整的 API 地址，含路径参数，不含 query string"
        },
        "headers": {
          "type": "object",
          "label": "请求头", "ui": "keyValue",
          "aiHint": "以 JSON 对象格式填写，如 {\"Authorization\": \"Bearer xxx\"}"
        },
        "parameterContract": {
          "type": "object",
          "label": "参数格式契约", "ui": "jsonEditor",
          "aiOptimize": {
            "fieldId": "api_parameter_contract",
            "description": "根据 API 描述生成符合 JSON Schema 规范的参数定义"
          }
        },
        "parameterBinding": {
          "type": "string", "enum": ["query","jsonBody","formBody"],
          "label": "参数绑定方式", "default": "query", "ui": "select"
        }
      }
    }
  }
]
```

每个字段支持：

| 字段 | 说明 |
|------|------|
| `ui` | 声明前端渲染什么控件（select / input / textarea / jsonEditor / codeEditor / keyValue / switch 等） |
| `aiHint` | 字段级提示，告诉 LLM 这个字段怎么填，前端展示在输入框旁边 |
| `aiOptimize` | 字段级 AI 优化入口，关联 Gateway 上注册的 `skill-text-prompts` 配置，该字段可独立调 LLM 优化 |

前端做一个通用的 `ConfigFormRenderer`，根据 `ui` 字段动态渲染控件。**所有类型统一走 Schema 驱动，不保留硬编码的高频类型特例。**

**收益**：新增类型只改 Gateway 的 configSchema，前端零改动。

---

## 七、Agent Core 改动清单

| 改动项 | 当前文件 | 改动类型 | 说明 |
|--------|---------|---------|------|
| `executeConfiguredApiSkill` 的 HTTP 组装部分 | `java-skills.ts` | **删除** | URL/query/header/body 拼接移至 Gateway |
| `normalizeApiSkillPayload` | `java-skills.ts` | 保留 | 参数归一化属于参数处理，留在 Agent |
| `collectParameterDefaults` | `java-skills.ts` | 保留 | 默认值合并属于参数处理 |
| `collectMergedScalarFields` | `java-skills.ts` | **删除** | 为 HTTP 组装服务，随组装逻辑移走 |
| `normalizeParameterBindingValue` | `java-skills.ts` | **删除** | 配置解析移至 Gateway |
| `toQueryRecord` / `buildUrlWithQuery` | `java-skills.ts` | **删除** | 移至 Gateway |
| `mergeHeadersForApiProxy` | `java-skills.ts` | **删除** | 移至 Gateway |
| `mergeJsonBodyForProxy` / form body 逻辑 | `java-skills.ts` | **删除** | 移至 Gateway |
| `executeCurrentTimeSkill` | `java-skills.ts` | **删除** | 改为普通 api Skill，Gateway 执行 |
| `executeConfiguredApiSkillAsync` (异步轮询) | `java-skills.ts` | **删除** | 移至 Gateway 内部 |
| `executeAsyncTaskPolling` / `postPollingAudit` | `java-skills.ts` | **删除** | 审计逻辑移至 Gateway |
| kind 分派分支 (`if kind === ...`) | `java-skills.ts` | **删除** | 改为统一调 `POST /api/skills/execute` |
| `applyExtendedSkillConfirmationGate` | `java-skills.ts` | **删除** | 确认判断移至 Gateway |
| `buildConfirmedToolArgs` | `java-skills.ts` | **修改** | 适配新的确认流（带 requestId） |
| `executeOpenClawSkill` | `java-skills.ts` | 保留 | 子规划需要 LLM，合理在 Agent |
| `buildExtendedSkillZodSchema` | `java-skills.ts` | 保留 | LLM 需要结构化 tool schema |
| Ajv 校验逻辑 | `java-skills.ts` | 保留 | 紧致纠错循环 |
| `DynamicStructuredTool` 注册逻辑 | `java-skills.ts` | **简化** | func 内部不再做分派，统一调 Gateway |
| interrupt/SSE/确认等待 | `agent.controller.ts` | **简化** | 确认判断逻辑移走，但保留 interrupt 机制 |
| `agent.ts` 工具注册 | `agent.ts` | **简化** | 工具 func 变短 |

---

## 八、Skill Gateway 改动清单

| 改动项 | 改动类型 | 说明 |
|--------|---------|------|
| 新增统一执行端点 `POST /api/skills/execute` | **新增** | 接收 `{ skillId, parameters, confirmed?, requestId? }` |
| HTTP 请求组装逻辑 | **新增** | 从 Agent 移入的 URL 拼接、header 合并、body 构造 |
| `parameterBinding` 路由 | **新增** | query/jsonBody/formBody 执行分支 |
| 确认门逻辑 | **新增** | 读 requiresConfirmation → 返回 CONFIRMATION_REQUIRED 或直接执行 |
| 确认状态存储 | **新增** | 内存 `ConcurrentHashMap<String, PendingConfirmation>` |
| `POST /api/skills/confirm` | **新增** | 或复用 execute 端点（confirmed: true 时执行） |
| 异步轮询逻辑 | **迁移** | 从 Agent 移入，Gateway 内部完成提交→轮询→返回 |
| 执行类型注册端点 `GET /api/system-skills/execution-types` | **新增** | 返回所有类型的 configSchema，供前端动态渲染 |
| 当前时间 Skill | **迁移** | 从 Agent 移入，作为普通 api Skill 执行 |
| 冗余端点清理 | **合并** | 见下方第九章 |

---

## 九、Gateway 底层执行端点整合

### 9.1 当前冗余情况

Gateway 的 SSH 执行和 HTTP API 执行各有多个端点调用同一底层方法：

```
SSH 执行（三个入口 → 同一个 BuiltinToolExecutionService.executeSsh()）：
  POST /api/skills/ssh               ← Agent 的 JavaSshTool + 扩展 SSH Skill
  POST /api/skills/linux-script      ← Agent 的 JavaLinuxScriptTool
  POST /api/system-skills/execute    ← AGENT_BUILTIN_SKILL_DISPATCH=gateway 时

HTTP API 执行（两个入口 → 同一个 BuiltinToolExecutionService.callExternalApi()）：
  POST /api/skills/api               ← Agent 的扩展 API Skill + built-in api_caller
  POST /api/system-skills/execute    ← AGENT_BUILTIN_SKILL_DISPATCH=gateway 时

计算执行（同上模式）：
  POST /api/skills/compute
  POST /api/system-skills/execute    ← COMPUTE case
```

根因：历史遗留的 `AGENT_BUILTIN_SKILL_DISPATCH` 环境变量（`legacy` vs `gateway`）导致同一底层服务暴露了两套入口。

### 9.2 整合策略

| 端点 | 处理方式 |
|------|---------|
| `POST /api/skills/execute`（新建） | **唯一对外执行入口** |
| `POST /api/skills/api` | 保留兼容，内部转调 `/execute`。Agent 切完后可下线 |
| `POST /api/skills/ssh` | 保留兼容，内部转调 `/execute`。Agent 切完后可下线 |
| `POST /api/skills/linux-script` | 保留兼容，内部转调 `/execute`（kind=ssh 时自动走台账解析） |
| `POST /api/skills/compute` | 保留兼容，内部转调 `/execute` |
| `POST /api/system-skills/execute` | 保留兼容，内部转调 `/execute` |
| `POST /api/skills/api/async` | 异步轮询逻辑并入 `/execute` 内部 |

目标收敛为 **一个端点** `POST /api/skills/execute`，其余逐步下线。下线节奏：

- Phase 2 Agent 切完后，`/api`、`/ssh`、`/linux-script`、`/api/async` 变为无调用方可下线
- `/api/system-skills/execute` 和 `/api/skills/compute` 随 `AGENT_BUILTIN_SKILL_DISPATCH` 配置废弃后下线

---

## 十、不纳入本次改造的内容

| 内容 | 原因 |
|------|------|
| MCP 协议标准化（tools/list、tools/call） | 影响面大，后续单独评估 |
| Skill 定义格式标准化 | 后续单独评估 |
| 文件系统 SKILL.md 管理方式调整 | 后续单独评估 |
| 日志体系统一 | 后续单独推进 |
| OPENCLAW 子规划 | 当前在 Agent 侧合理，不改 |

---

## 十一、改造前后对比

| | 当前 | 改造后 |
|---|------|--------|
| Agent 总行数 | ~5000 行 | ~3500 行 |
| `java-skills.ts` 行数 | ~2800 行 | ~1200 行 |
| 新增一个执行能力 | 改 Agent + Gateway + 前端 | 只改 Gateway（前端 Schema 自动适配） |
| 确认安全的守门人 | Agent 自决（可绕开） | Gateway 强制执行（无法绕开） |
| Agent 调 Gateway 的端点 | 多个（`/api`、`/ssh`、`/compute`、`/linux-script`、`/api/async`、`/system-skills/execute`） | 一个（`/api/skills/execute`），其余逐步下线 |
| 前端新增 Skill 类型 | 手写 Vue 表单 | Gateway 返回 Schema，前端自动渲染 |
| 字段级 AI 优化 | 只支持整段 JSON 优化 | 每个输入项独立 AI 优化入口 |
