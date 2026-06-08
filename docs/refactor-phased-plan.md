# Agent-Gateway 职责重划分：分步实施方案

> 基于：[refactor-plan-agent-gateway-skill-division.md](./refactor-plan-agent-gateway-skill-division.md)
> 原则：每步可独立测试，每步对业务零影响或可回退

---

## 总体策略

```
Phase 1: Gateway 建立统一执行能力（Agent 不改，新旧端点并存）
Phase 2: Agent 切换到统一端点（删除执行逻辑，保留校验和确认等待）
Phase 3: 异步轮询迁移 + 前端 Schema 渲染 + 收尾清理
```

核心思路：**先在 Gateway 把能力建好并验证，再让 Agent 切过来。** 每做完一步，整个系统都是可运行的。

---

## Phase 1：Gateway 统一执行能力建设

**目标**：Gateway 具备完整的 Skill 执行能力（HTTP 组装 + 确认门），新旧端点并存，Agent 不变。

**测试策略**：用 curl 调 Gateway 新端点验证，不影响现有业务。

### 1.1 新增 `POST /api/skills/execute` 端点

请求格式：
```json
{
  "skillId": 42,
  "parameters": {
    "env": "dev",
    "serverId": "srv-01"
  }
}
```

内部流程：
```
1. 根据 skillId 读 skills 表，获取 configuration
2. 根据 kind 路由：
   - kind=api → 拼 HTTP 请求 → 通过 ApiProxyService 代理出站
   - kind=ssh  → 台账解析 → SSH 执行
   - kind=template → 返回 configuration.prompt
3. 返回执行结果
```

### 1.2 实现 HTTP 请求组装

在 Gateway 侧实现 Agent 当前 `java-skills.ts` 中的逻辑：

| 功能 | 说明 |
|------|------|
| 参数默认值合并 | `mergeDefaults(parameters, parameterContract)` |
| URL 拼接 | `buildUrlWithQuery(endpoint, query)` |
| Header 合并 | `mergeHeaders(headers, method, parameterBinding)` |
| Body 构造 | `buildBody(parameters, body, parameterBinding)` |
| ParameterBinding 路由 | query / jsonBody / formBody 三分支 |

### 1.3 实现确认门

```
收到 execute 请求
  → 读 Skill 配置 → requiresConfirmation = true 且 未带 confirmed
  → 生成 requestId → 存入 ConcurrentHashMap（含 skillId、parameters、userId、expiresAt）
  → 返回 { status: "CONFIRMATION_REQUIRED", requestId, ... }

收到 execute 请求（confirmed: true, 带 requestId）
  → 从 Map 校验 requestId（存在 + 未过期 + 用户匹配）
  → 执行 → 返回结果 → 删除 requestId
```

过期清理：定时任务每 60 秒清理超过 5 分钟的待确认记录。

### 1.4 旧端点兼容包装

当前 Agent Core 还通过多个旧端点调用 Gateway。Phase 1 不强制 Agent 改，而是将旧端点内部转调新的 `/execute`：

| 旧端点 | 处理方式 |
|--------|---------|
| `POST /api/skills/api` | 内部转调 `/execute`，注入 `skillId`（根据 skill 名称查库映射） |
| `POST /api/skills/ssh` | 同上 |
| `POST /api/skills/linux-script` | 同上，kind=ssh 时自动走台账解析 |
| `POST /api/skills/compute` | 内部转调 `/execute` |
| `POST /api/system-skills/execute` | 废弃 `BuiltinToolExecutionService` 直调，改为转调 `/execute` |
| `POST /api/skills/api/async` | **不动**，Phase 3 再处理 |

这样 Gateway 侧底层收敛到唯一执行路径，旧端点变为薄包装。Agent 切完后即可下线。

### 1.5 验证

```bash
# 1. 新端点：不带确认的 API Skill 直接执行
curl -X POST /api/skills/execute \
  -H "X-Agent-Token: xxx" \
  -H "X-User-Id: 001" \
  -d '{"skillId": 1, "parameters": {"env": "dev"}}'

# 2. 新端点：带确认的 Skill 返回 CONFIRMATION_REQUIRED
curl -X POST /api/skills/execute \
  -H "X-Agent-Token: xxx" \
  -H "X-User-Id: 001" \
  -d '{"skillId": 5, "parameters": {"action": "restart"}}'
# 预期: { "status": "CONFIRMATION_REQUIRED", "requestId": "...", ... }

# 3. 新端点：确认后执行
curl -X POST /api/skills/execute \
  -H "X-Agent-Token: xxx" \
  -H "X-User-Id: 001" \
  -d '{"skillId": 5, "parameters": {"action": "restart"}, "confirmed": true, "requestId": "..."}'

# 4. 旧端点兼容：调 /api/skills/api 结果和调 /execute 一致
curl -X POST /api/skills/api \
  -H "X-Agent-Token: xxx" \
  -d '{"url": "...", "method": "GET", "headers": {}, "body": null}'
# 预期: 行为和改前一模一样（内部实际走 /execute 链路）
```

### 1.6 本阶段产出

| 文件 | 改动 |
|------|------|
| `SkillController.java` | 新增 `POST /api/skills/execute` + 旧端点转调包装 |
| `SkillExecutionService.java`（新） | HTTP 组装 + kind 路由 + 确认门 + 执行分派 |
| `PendingConfirmationStore.java`（新） | 内存确认状态管理 |
| `BuiltinToolExecutionService.java` | 保留，但执行路径统一经过 `SkillExecutionService` |

---

## Phase 2：Agent 切换到统一端点

**目标**：Agent Core 的 `DynamicStructuredTool.func` 不再做执行分派和 HTTP 组装，统一调 Phase 1 建立的 `/execute` 端点。确认流适配新的两段式交互。

**测试策略**：端到端测试——发消息触发 Skill 调用，验证调用链路正确。

### 2.1 `DynamicStructuredTool.func` 简化

改造前（`java-skills.ts` 约 150 行分派逻辑）：
```typescript
// 当前
func: async (args) => {
  // 确认门判断
  // if kind === 'api' → executeConfiguredApiSkill()
  // if kind === 'ssh' → executeServerResourceStatusSkill()
  // if kind === 'template' → 返回 prompt
  // if OPENCLAW → executeOpenClawSkill()
  // ... 大量 HTTP 组装代码
}
```

改造后（约 30 行）：
```typescript
func: async (args) => {
  // 收集默认值 + 合并
  const merged = { ...collectDefaults(skill.parameterContract), ...args };

  // Ajv 校验
  const validationResult = validateWithAjv(merged, skill.parameterContract);
  if (!validationResult.valid) {
    return JSON.stringify(validationResult.error);
  }

  // 统一调 Gateway
  const response = await axios.post(gatewayUrl + '/api/skills/execute', {
    skillId,
    parameters: merged,
  });

  // 处理确认
  if (response.data.status === 'CONFIRMATION_REQUIRED') {
    throw new ConfirmationRequiredError(response.data);
  }

  return JSON.stringify(response.data);
}
```

OPENCLAW 保留原有逻辑，不走 `/execute`。

### 2.2 确认流适配

当前 Agent 的确认流是自己读 `requiresConfirmation` 后 interrupt。改为：收到 Gateway 返回的 `CONFIRMATION_REQUIRED` 后 interrupt。

改造点集中在 `agent.controller.ts` 的 stream 处理循环中：

```
收到 tool 调用结果 → 检测到 { status: "CONFIRMATION_REQUIRED" }
  → interrupt → SSE 推 confirmation_request 给前端
  → 等用户确认
  → resume → 重新调 Gateway: { ..., confirmed: true, requestId, adjustedParams }
```

### 2.3 删除的代码

| 文件 | 删除内容 |
|------|---------|
| `java-skills.ts` | `executeConfiguredApiSkill` 整个函数（HTTP 组装部分） |
| `java-skills.ts` | `normalizeParameterBindingValue` |
| `java-skills.ts` | `collectMergedScalarFields` |
| `java-skills.ts` | `toQueryRecord` / `buildUrlWithQuery` |
| `java-skills.ts` | `mergeHeadersForApiProxy` |
| `java-skills.ts` | `mergeJsonBodyForProxy` + form body 逻辑 |
| `java-skills.ts` | `executeCurrentTimeSkill` |
| `java-skills.ts` | kind 分派分支（api/ssh/template） |
| `java-skills.ts` | `applyExtendedSkillConfirmationGate` |

### 2.4 保留并适配的代码

| 文件 | 保留内容 | 适配说明 |
|------|---------|---------|
| `java-skills.ts` | `buildExtendedSkillZodSchema` | 不变 |
| `java-skills.ts` | `collectParameterDefaults` | 不变 |
| `java-skills.ts` | `normalizeApiSkillPayload` | 不变 |
| `java-skills.ts` | Ajv 校验逻辑 | 不变 |
| `java-skills.ts` | `executeOpenClawSkill` | 继续走独立路径 |
| `java-skills.ts` | `buildConfirmedToolArgs` | 适配带 requestId 的新格式 |
| `agent.controller.ts` | interrupt/SSE 处理 | 适配 CONFIRMATION_REQUIRED 来源（从自判断改为读 Gateway 返回） |

### 2.6 旧端点下线

Agent 切完后，以下端点可**下线**（删除 Controller 方法 + SecurityConfig 放通规则）：

| 端点 | 原因 |
|------|------|
| `POST /api/skills/api` | Agent 已切到 `/execute`，无调用方 |
| `POST /api/skills/ssh` | 同上 |
| `POST /api/skills/linux-script` | 同上 |
| `POST /api/skills/api/async` | Agent 已切到 `/execute`（Phase 3 将异步逻辑并入 execute 内部前暂保留） |

下线前确认：抓日志验证一周内无 legacy 模式调用。

### 2.7 验证

```bash
# 1. 不带确认的 API Skill：发消息 → LLM 调 Skill → 返回结果
# 2. 带确认的 Skill：发消息 → LLM 调 Skill → 弹确认框 → 用户确认 → 执行
# 3. SSH Skill：通过扩展 SSH Skill 触发 → Gateway 台账解析 → SSH 执行
# 4. Template Skill：LLM 调用 → 返回 prompt 文本
# 5. OPENCLAW：LLM 调用 → 子规划 → 多工具编排
```

### 2.8 本阶段产出

Agent 的 `java-skills.ts` 从 ~2800 行降至 ~1700 行（保留校验 + OPENCLAW，临时保留异步轮询方便 Phase 3 对比验证）。

---

## Phase 3：异步轮询迁移 + 前端 Schema 渲染 + 收尾

**目标**：完成剩余迁移，Agent 最终精简到位。

**测试策略**：异步轮询 Skill 端到端测试 + 前端配置页功能测试。

### 3.1 异步轮询迁移到 Gateway

Gateway `POST /api/skills/execute` 内部增加异步轮询处理：

```
收到 execute 请求
  → 读 Skill 配置 → 发现有 asyncPoll
  → 发起初始 API 请求 → 用 idJsonPath 提取外部 taskId
  → 创建 async_tasks 行（复用现有实体和 Scheduler）
  → 阻塞等待（轮询 DB 或 CompletableFuture）直到 COMPLETED/FAILED/TIMEOUT
  → 返回结果
```

Gateway 需要新增的能力：**同步阻塞等待异步任务完成**。两种实现方式：

| 方式 | 做法 | 适用 |
|------|------|------|
| CompletableFuture | 创建任务时注册 Future，Scheduler 完成时 complete | 推荐 |
| 轮询 DB | 类似当前 `GET /async-tasks/{id}/wait`，2 秒查一次 | 简单但有延迟 |

Agent 侧删除：
- `executeConfiguredApiSkillAsync`（约 170 行）
- `postPollingAudit`（约 40 行）

### 3.2 前端配置页 Schema 驱动

Gateway 新增 `GET /api/system-skills/execution-types`。

前端改动：
1. 新增 `ConfigFormRenderer.vue` 通用组件，根据 Schema 的 `ui` 字段动态渲染
2. `SkillManagementModal.vue` 改为调用 `ConfigFormRenderer`
3. 删除原有的 api/ssh/template 硬编码表单代码

### 3.3 Gateway 执行类型注册

`GET /api/system-skills/execution-types` 返回各类型的 configSchema。初期注册 api、ssh、template 三种，后续新增类型只需在此接口追加即可。

### 3.4 Agent 最终清理

| 文件 | 删除内容 |
|------|---------|
| `java-skills.ts` | `executeConfiguredApiSkillAsync` |
| `java-skills.ts` | `postPollingAudit` |
| `java-skills.ts` | `executeAsyncTaskPolling`（如有） |
| `java-skills.ts` | `executeConfiguredApiSkill` 的 asyncPoll 分支 |

### 3.5 验证

```bash
# 1. 异步轮询 Skill：发消息 → 长时间等待 → 返回结果
# 2. 前端配置页：打开 Skill 管理 → 新增 Skill → 三种类型表单正常渲染
# 3. 回归：Phase 2 已验证的所有 Skill 类型仍正常
```

---

## 各阶段影响面总结

| | Phase 1 | Phase 2 | Phase 3 |
|---|---------|---------|---------|
| Gateway | 新增 `/execute` + 旧端点转调包装 + 确认门 | ❌ 不改 + 下线旧端点 | 异步轮询闭环 + `execution-types` 端点 |
| Agent | ❌ 不改 | 切换统一端点 + 删执行逻辑 + 适配确认流 | 删异步轮询代码 |
| 前端 | ❌ 不改 | ❌ 不改 | ConfigFormRenderer |
| 端点数量 | 新增 1 个，保留 7 个 | 下线 4 个，剩 4 个 | 收敛到 1 个 |
| 业务影响 | 零（新旧端点并存） | Skill 调用链路切换 | 前端配置页变更 |
| 可回退 | ✅ 新端点不用即可 | ✅ 切回旧分支 | ✅ 前端回退旧表单 |

---

## 推荐时间线

```
Phase 1: 1-2 周（Gateway 独立开发 + 单测 + curl 验证）
Phase 2: 1-2 周（Agent 删代码 + 适配 + 端到端回归）
Phase 3: 1-2 周（异步轮询 + 前端 + 清理收尾）
         ─────
总计:      3-6 周
```
