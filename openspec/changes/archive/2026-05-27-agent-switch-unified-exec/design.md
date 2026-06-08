## Context

Phase 1 已在 Gateway 建立了 `POST /api/skills/execute` 端点（含 HTTP 组装、确认门、kind 分派、默认值合并），旧端点已通过转调包装实现底层收敛。新端点通过 curl 和端到端测试验证可用。

当前 Agent Core 的 `java-skills.ts`（~2800 行）仍然包含大量执行逻辑——`executeConfiguredApiSkill` 做完整的 HTTP 组装（URL 拼接、Header 合并、Body 构造、parameterBinding 路由），`executeServerResourceStatusSkill` 做 SSH 台账解析和命令执行。这些逻辑应移到 Gateway。

## Goals

- Agent Core 的 `DynamicStructuredTool.func` 不再做执行分派，统一调 `POST /api/skills/execute`
- 删除 `java-skills.ts` 中 ~1100 行 HTTP 组装和 kind 分派代码
- 确认流从"Agent 自判"改为"读取 Gateway 返回"，保留 LangGraph interrupt 机制
- 下线 Gateway 旧端点（`/api/skills/api`、`/ssh`、`/linux-script`、`/compute`）

## Non-Goals

- 不修改 OPENCLAW 子规划（当前在 Agent 侧合理）
- 不处理异步轮询（`/api/skills/api/async`）的迁移（Phase 3）
- 不修改前端
- 不修改文件系统 Skill（SKILL.md）管理方式

## Decisions

### 1. `DynamicStructuredTool.func` 简化策略

**选择**：func 内保留默认值收集 + Ajv 校验，执行统一发 Gateway。分三步：

```
1. merged = { ...collectDefaults(skill.parameterContract), ...args }
2. validateWithAjv(merged) → 失败直接返回错误给 LLM
3. axios.post(gatewayUrl + '/api/skills/execute', { skillId, parameters: merged })
   → 正常结果：返回给 LLM
   → CONFIRMATION_REQUIRED：抛 ConfirmationRequiredError → controller 层 interrupt
```

**理由**：
- 默认值收集和 Ajv 校验需要 `parameterContract` Schema 信息，已在 Agent 侧（用于生成 Zod schema），保留成本低
- 紧致纠错循环：校验失败在同轮对话反馈 LLM，无需 Gateway 往返
- HTTP 组装全部由 Gateway 完成，Agent 不再知道 `parameterBinding` 等概念

### 2. 确认流触发方式

**选择**：Agent 不再读 `requiresConfirmation`，改为检测 Gateway 返回的 `{ status: "CONFIRMATION_REQUIRED" }`。

当前流程：
```
Agent 读 skill.requiresConfirmation → 自己判断 → interrupt → SSE
```

改后流程：
```
Agent 调 Gateway /execute → 收到 { status: "CONFIRMATION_REQUIRED" } → interrupt → SSE
Agent 收到用户确认 → 调 Gateway /execute { ..., confirmed: true, requestId } → 执行
```

**理由**：确认安全的守门人是 Gateway（已在 Phase 1 实现），Agent 不应重复判断。且撇开 Agent 直接调 Gateway 时确认门仍有效。

### 3. 旧端点下线策略

**选择**：Agent 切完后直接删除旧端点方法，不做过渡期。

**理由**：
- Phase 1 已实现旧端点转调包装，旧端点内部实际走的是新链路
- 删除旧端点只是去掉薄包装，不影响功能
- 如果出问题，回退 Phase 2 即可恢复

### 4. SSH Skill 调用中 server_lookup 的保留

**选择**：`executeServerResourceStatusSkill` 删除，但其 server_lookup 逻辑由 Agent 的 tool 调用链保证。Agent 需要先调 `server_lookup` 解析服务器名，再用精确名称调 Gateway `/execute`。

**理由**：server_lookup 是 Agent 的推理步骤（模糊 → 精确），不是执行逻辑。Gateway `/execute` 只接受精确的 serverName。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Agent 切到新端点后旧 Skill 调用失败 | Phase 1 已验证新端点与旧端点行为一致；可回退 Phase 2 |
| 确认流改动影响现有确认机制 | 保留 LangGraph interrupt 机制不变，只改触发来源 |
| 删除 `executeConfiguredApiSkill` 可能遗漏隐藏依赖 | `grep -r` 全库搜索引用，确保无遗漏 |
| SSH Skill 去掉内置 server_lookup 后 LLM 可能不知道先查服务器 | 系统提示词中保留 server_lookup 工具的描述 |
| 旧端点下线后 `AGENT_BUILTIN_SKILL_DISPATCH=legacy` 模式失效 | 该配置已无意义，随旧端点一起废弃 |

## Migration Plan

1. 修改 `java-skills.ts`：删除 HTTP 组装和分派函数，简化 func
2. 修改 `agent.controller.ts`：适配确认流触发方式
3. 运行 `npm run build` 确认编译通过
4. 端到端回归测试（API Skill / SSH Skill / Template / 确认流 / OPENCLAW）
5. 删除 Gateway 旧端点
6. 运行 `mvn compile` 确认编译通过
7. 旧端点不可用验证（curl 404）
