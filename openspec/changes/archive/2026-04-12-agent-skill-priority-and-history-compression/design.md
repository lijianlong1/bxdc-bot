## Context

Fishtank 在 `agent-core` 中同时暴露：**内置工具**（`JavaApiTool`、`JavaSshTool`、`compute`、`linux_script_executor` 等）与 **SkillGateway 动态扩展 Skill**（`loadGatewayExtendedTools`）。短期历史由前端 `useChat` 发送 `history[]` 与当前用户消息一并进入 `/agent/run`（经网关 `TaskController` 传入 `executionContext`）。

## Goals

1. **扩展优先**：在「同一能力域」存在已加载的 EXTENSION 工具时，模型应走扩展 Skill，而非凭历史中的 URL/命令模式调用底层内置工具。
2. **历史瘦身**：含渐进披露的中间轮次不应把大块 `REQUIRE_PARAMETERS` / 契约正文带入后续 `history`，避免上下文膨胀与错误复现披露流程。

## Non-goals

- 不在本 change 内重做 Skill Hub UI 或网关 CRUD。
- 不强制对长期记忆（mem0）做同样压缩（可后续单独开 change）。

## Design

### A. Extended-skill-first policy（提示词 + 可选元数据）

- **系统提示**（注入在 user instruction 前，与现有 `AGENT_SKILL_GENERATOR_POLICY` 等并列）增加 **`[Extended skill routing]`** 段：明确规则——若工具列表中存在与用户需求匹配的 **扩展 Skill**（名称/描述可见于当前会话），**必须**优先调用该扩展工具；**禁止**为同一任务改用 `ssh_executor` / 网关 API 直连类等内置工具 **代替** 扩展 Skill，除非用户明确要求底层工具或扩展 Skill 不适用。
- **工具描述层**（可选、实现时评估 token）：对内置 `JavaApiTool`/`JavaSshTool` description 增加一句 **“若存在覆盖同类能力的扩展 Skill，请使用扩展 Skill。”** 避免与扩展名冲突的过度限制。
- **冲突处理**：当多个扩展 Skill 可能匹配时，保留「先澄清再调用」的既有行为；不要求自动合并工具。

### B. History compression（何处裁剪）

**优先在 agent-core `/agent/run` 对 `history` 做规范化（单一真相）**，前端可再做一层兼容裁剪（幂等、短字段）。

1. **识别渐进披露响应**：assistant/tool 内容中出现 `REQUIRE_PARAMETERS`、`status":"REQUIRE_PARAMETERS"`、大块 `parameterContract` 全文等（与 `java-skills` 约定对齐）。
2. **压缩规则**：
   - **删除或替换**上述块为短占位，例如：`[参数已在此前的步骤中确认]`或仅保留用户最终传入的 JSON 摘要（截断长度上限在实现中常量定义）。
   - **保留**：用户消息、最终工具 **成功结果**（或错误一行摘要）、以及非披露性质的 assistant 自然语言（可截断）。
3. **已完成任务**：同一 `sessionId` 多轮内，若某轮工具已达到 `completed` 且用户意图已满足，后续 history 中该轮 **不再带** 渐进披露正文（与上条合并实现）。

### C. 数据流

```
Frontend history  →  Gateway  →  agent-core run (sanitizeHistory)  →  createAgent messages
```

若仅前端裁剪：网关仍可能从其他客户端发脏 history；**因此 server-side sanitize 为必选**，前端为可选优化。

**当前实现**：默认前端 **不** 维护双份 `history`（界面列表仍为完整正文）；瘦身 **完全由** `POST /agent/run` 侧的 `sanitizeHistoryForAgent` 承担；若以后在 `useChat` 增加发送前裁剪，应保持与服务器规则一致且幂等。

## Risks

| 风险 | 缓解 |
|------|------|
| 过度裁剪导致模型丢失必要参数 | 保留「最终参数 JSON」摘要与最后一次成功 tool result；占位符固定可搜 |
| 内置工具描述过长 | 仅追加一句短规则；监控 token |
| 与 OPENCLAW 子工具混淆 | routing 段强调 **EXTENSION 动态工具名**（`extended_*`）优先 |

## Open questions

1. `history` 是否包含原始 `role: tool` 消息由前端决定——sanitize 应对 **user/assistant** 字符串与 **tool 角色**（若存在）一并处理。
2. 压缩是否对 **当前** 最后一轮即时生效：默认 **仅压缩之前轮次**，当前正在进行的披露轮仍可全量（实现时可配置）。

## References

- `backend/agent-core/src/agent/agent.ts`、`agent.controller.ts`（`history` 组装）
- `backend/agent-core/src/tools/java-skills.ts`（`REQUIRE_PARAMETERS`）
- `frontend/src/composables/useChat.ts`（`history` 构造）
