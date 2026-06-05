## Why

主对话 Agent 当前将身份类信息与策略、技能上下文、用户指令一并塞入单条 `user` 消息，缺少对「自身职责与能力边界」的显式说明，不利于模型对齐平台定位。同时 OpenAI 兼容栈中 **`system` 与 `user` 的典型权重不同**，将稳定、全局的策略与角色说明放入 `system` 更符合常见实践，并与 `preModelHook` 中已存在的任务状态 `SystemMessage` 形成清晰分层。

## What Changes

- 在 **agent-core** 的 `Prompts` 模块（`zh` / `en` 双语）中新增 **Agent 角色与职责** 文案，说明 Agent 的定位、工作方式（通过工具与 Skill Gateway 扩展能力协助用户）及高层行为期望。
- 将 **静态、可复用的策略类提示词**（现有四条 policy）与 **角色说明** 组合为一段（或结构化多段拼接）**由 `system` 角色承载**的提示；与 **当次会话相关** 的内容（`skillContext`、记忆注入、本次 `User Instruction`）保留在 **`user` 侧**（或独立 `user` 消息块），避免把动态信息误塞入全局 system。
- **`AGENT_PROMPTS_LANGUAGE`** 为 `zh` / `en`（及无效值回退 `en`）时，角色与策略文案均与语言一致；不新增第三种语言文件，与现有多语言机制对齐。

## Capabilities

### New Capabilities

- `agent-core-system-messages`：定义 agent-core 在一次 `run` 请求中如何拆分 **system** 与 **user** 提示层、以及双语角色与策略内容的一致性要求。

### Modified Capabilities

- （无）本变更不修改已有 `openspec/specs/` 下与前端或 Gateway 契约相关的需求；行为变更集中在 agent-core 提示装配。

## Impact

- **代码**：`backend/agent-core` — `src/prompts/types.ts`、`zh.ts`、`en.ts`、`index.ts`；`src/controller/agent.controller.ts`（`runTask` 消息数组构造）；可能需补充/调整与多 `SystemMessage` 相关的单测或注释。
- **行为**：对外 HTTP API 形态不变；仅 LLM 输入中消息角色与内容分段变化，需回归主对话与带任务状态（`preModelHook`）场景。
- **依赖**：无新 npm 包；依赖各 LLM 提供商对首条/多条 `system` 消息的支持（设计阶段明确验证策略）。
