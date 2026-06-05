## Why

扩展 Skill 与网关内置类工具（如 `java_api`、`ssh_executor`）常并存。模型在有多轮对话记忆时，容易**绕过已加载的扩展 Skill**，直接沿用记忆中的 URL/SSH 方式调用底层工具，导致用户配置的扩展能力闲置。另一方面，带**渐进披露**（`REQUIRE_PARAMETERS`、冗长契约说明等）的轮次若**原样进入后续 history**，会重复占用上下文，甚至诱导模型再次走披露流程而非直接复用已填好的能力。

## What Changes

- **路由策略**：当当前会话已从 SkillGateway 加载了与任务语义相关的 **EXTENSION** 工具时，Agent SHALL 优先使用扩展 Skill 工具完成同类能力，系统提示与工具元数据 SHALL 明确 **禁止在有可用扩展 Skill 时** 为同一意图优先选择并行的 **built-in** 直连工具（如通用 API/SSH/计算等），除非扩展 Skill 明确不适用或用户指定。
- **历史压缩**：对已**结束**的、与渐进披露相关的 assistant/tool 回合，写入传给 Agent 的 **short-term history** 时 SHALL **省略**披露 scaffolding（如 `REQUIRE_PARAMETERS` 大块、`interfaceDescription`/`parameterContract` 全文），**仅保留**用户最终意图、已选参数摘要及 **工具成功结果**（或简短失败摘要），以降低下游轮次 token 与误用风险。

## Capabilities

### New Capabilities

- `agent-extended-skill-priority`: 扩展 Skill 相对内置同类工具的优先策略与提示词/元数据约束
- `agent-history-compression`: 面向模型的短期历史：渐进披露内容的剥离与工具结果保留规则

### Modified Capabilities

- `agent-client`: 任务请求中附带的 `history` 数组的构成规则（与本 change 对齐时，客户端或网关侧与后端约定一致的压缩/裁剪字段）
- `skill-discovery`: 可选增强——加载的扩展 Skill 在系统上下文中与「内置工具」的并列关系说明（若实现合并进 `agent-extended-skill-priority` 的 delta，则本项可为轻量 MODIFIED）

## Impact

- **backend/agent-core**：`AgentFactory` / `skill.manager` / 注入的系统提示；`java-skills` 渐进披露返回形态若需配合「不落历史」需与控制器/history 管道对齐；任务 `run` 入口对 `history` 的规范化（若服务端裁剪）。
- **frontend**：`useChat` 构造 `history` 时可选裁剪 assistant/tool 文本（与 spec 一致时与后端二选其一或双端容错）。
- **openspec**：新建两条能力 spec + `agent-client` 增量；落地后与 `skill-discovery` 的关系在 design 中写清避免重复。
