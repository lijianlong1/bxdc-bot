## Why

平台已以 **扩展 API Skill** 为主路径调用外部 HTTP；内置 `api_caller`（`JavaApiTool`）与扩展能力在职责上重叠，易让维护者误解「扩展是否通过 `api_caller` 实现」。同时默认挂载通用 HTTP 原语会增大模型越权或绕过受控 Skill 调用的风险。本变更在 **不删除实现代码** 的前提下，从 Agent **默认工具集** 中移除 `api_caller` 的挂载，并在 spec 中 **明确扩展 API Skill 的端到端请求路线**，减少后续设计偏差。

## What Changes

- Agent Core：**不再**在默认 `createAgent` / `AgentFactory` 中注册 `JavaApiTool`（`api_caller`）；**保留** `JavaApiTool` 类及现有调用 Gateway 的逻辑，在代码处用中文注释标注 **暂停用/未默认挂载** 及原因。
- 文档与契约：在 **spec** 中明确：**扩展 API Skill** 在 Agent 侧经 `executeConfiguredApiSkill` 组包后请求 **`POST {gateway}/api/skills/api`**，与 **内置工具名** `api_caller` 及（若启用时）`POST /api/system-skills/execute` 路线 **正交**；并规定默认运行时 **不暴露** `api_caller` 给 LLM。

## Capabilities

### New Capabilities

- `agent-builtin-api-caller-policy`：规定 Agent 默认不挂载 `api_caller`；允许保留 `JavaApiTool` 实现并标注为暂时停用，便于未来按配置恢复。

### Modified Capabilities

- `api-skill-invocation`：在既有「调用前校验、参数归一化」等要求之外，**新增** 对 **扩展 API Skill 与 built-in `api_caller` 在 Agent 侧执行路线上的区分** 的规范性要求，避免将二者混为一谈。

## Impact

- **受影响**：`backend/agent-core`（`agent.ts` 等工具注册处）、`JavaApiTool` 定义处注释、提示词中若**列举**了 `api_caller` 作为可用内置，需与「未挂载」一致（可改为「若已挂载」或删除对该内置的引导）。
- **不受影响**：Skill Gateway 的 `POST /api/skills/api`、`ApiProxyService`、`system_skills` 中 `api_caller` 行（**非必须**随本变更删除，可按后续治理单独处理）；**扩展 API Skill** 执行链路保持不变。
- **BREAKING（行为面）**：依赖对话中 **显式** 让模型使用内置 `api_caller` 做任意 URL 调用的工作流将 **不再可用**（除非以后通过配置或代码重新挂载）。
