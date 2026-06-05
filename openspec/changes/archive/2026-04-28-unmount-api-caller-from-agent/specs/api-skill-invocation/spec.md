## ADDED Requirements

### Requirement: 扩展 API Skill 与 built-in `api_caller` 的 Agent 侧执行路线区分

对 **类型为 `EXTENSION`、且 HTTP 能力由持久化 `configuration` 与 `executeConfiguredApiSkill` 实现的 API Skill**（以下称「扩展 API Skill」），系统 SHALL 在 **Agent 进程内** 将 LLM 提供的参数与 Skill `configuration` 合并并校验后，向 Skill Gateway 发送 **HTTP 代理** 请求；该路径 MUST **不** 依赖、也 MUST **不** 等同于在同一对话中再调用 **名为 `api_caller` 的 built-in 工具**（`JavaApiTool`）。

对扩展 API Skill，Agent Core SHALL 将合并后的 `url`（含 query）、`method`、`headers`、`body` 以 JSON body 形式提交到 **`POST {GATEWAY_BASE}/api/skills/api`**（与项目代码中 `executeConfiguredApiSkill` 行为一致），并由 Gateway 的 HTTP 代理服务出站。

**MUST NOT** 将上述行为描述为「通过 `api_caller` 内置 Skill 实现扩展 API Skill」；`api_caller` 是 **独立** 的 built-in 工具，仅在 Agent **注册** 该工具时，由模型选择调用，其出站到 Gateway 的 **HTTP 入口** 可与扩展路径不同（例如经 `AGENT_BUILTIN_SKILL_DISPATCH=gateway` 时使用 `POST {GATEWAY_BASE}/api/system-skills/execute` 且 `toolName` 为 `api_caller`），但与扩展 Skill 的 **工具注册与调用图** 无关。

#### Scenario: 仅存在扩展 API Skill 且未注册 `api_caller` 时仍可出站

- **WHEN** 某部署中 Agent **未** 向 LLM 注册 `api_caller`（`JavaApiTool`）  
- **AND** 已加载并启用至少一个扩展 API Skill  
- **THEN** 模型对该扩展 Skill 的 tool 调用 SHALL 仍能通过 `POST /api/skills/api` 完成 HTTP 执行  
- **AND** 该过程 MUST NOT 要求或触发对 `api_caller` 工具名的调用

#### Scenario: 文档与实现叙述一致性

- **WHEN** 维护者阅读 OpenSpec 与本变更相关的实现说明  
- **THEN** 其 MUST 能区分 **扩展 API Skill** 的 `executeConfiguredApiSkill` → `/api/skills/api` 路线与 **可选 built-in** `api_caller` 路线，避免将两者混写为同一条「内置包裹扩展」的调用链
