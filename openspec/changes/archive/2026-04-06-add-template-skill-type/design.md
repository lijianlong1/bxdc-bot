## Context

当前扩展 Skill 中，CONFIG 模式已规范为 canonical `kind`（`api`、`ssh`）配合 preset/profile；OPENCLAW 单独使用 `executionMode` 与 `systemPrompt`。业务需要一类 **仅含提示词文本** 的可管理 Skill，用于复用文案、约束模型行为或作为子任务提示，但不发起 HTTP/SSH，也不走 OpenClaw 多步编排。本变更在 **CONFIG + 新 canonical kind** 上建模，以便与 API/SSH 共用同一套 Gateway 存储、校验与 UI 入口。

## Goals / Non-Goals

**Goals:**

- 引入 **模板**（Template）类 CONFIG Skill：`executionMode` 为 CONFIG，`configuration` 中仅包含 **提示词** 字段（实现层使用单一 JSON 键，见下文）。
- SkillGateway 能持久化、校验并列表展示；agent-core 侧能加载为工具并在调用时返回确定性结果（例如返回提示词 JSON 或约定格式字符串）。
- **Skill 生成器**（`JavaSkillGeneratorTool` 及前后端相关流程）能识别并生成该类型。

**Non-Goals:**

- 不定义模板如何在系统提示与用户消息之间注入的完整产品策略（由上层 Agent/编排后续消费返回内容即可）。
- 不将纯模板伪装为 `kind=api` 的 preset（避免与真实 HTTP 语义混淆）。

## Decisions

1. **Canonical kind 名称**  
   - 采用 `kind: "template"`（代码与存储中英标识，UI 可展示「模板」）。  
   - **理由**：与 `api`/`ssh` 并列清晰；避免与 OPENCLAW 的 `systemPrompt` 命名混用。

2. **Configuration 形态**  
   - 仅一个必填字符串字段：`prompt`（对应产品文案「提示词」）。  
   - **备选**：复用 `systemPrompt` —— 已用于 OPENCLAW，易与 CONFIG 模板混淆，故不采纳。

3. **校验规则**  
   - 创建/更新：`executionMode=CONFIG` 且 `configuration.kind === "template"` 时，`prompt` 必须为非空字符串；不得要求 `endpoint`、`method` 等 API 字段或 SSH 字段。

4. **运行时（agent-core）**  
   - 扩展 `java-skills`（或等价模块）：列表/详情解析 `configuration` 后，若为 template，工具执行返回 **结构化 JSON**（如 `{ "kind": "template", "prompt": "..." }`）或项目现有错误/透传约定，便于日志与二次解析。  
   - **理由**：与 API 返回 body 区分，避免纯文本歧义。

5. **生成器**  
   - 在 unified generator 的 `targetType`（或等价枚举）中增加 `template`；当用户意图为「只要提示词/模板/可复用文案」且无 URL/主机命令时，生成 `kind=template` 与 `prompt`。

6. **规范与现有 spec 的关系**  
   - `skill-kind-normalization` 中「CONFIG 仅 api/ssh」的表述 **扩展为包含 `template`**；preset 规则仍适用于 `api`/`ssh`，模板 **不** 通过 preset 挂在 `api` 下。

## Risks / Trade-offs

- **[Risk]** 与 OPENCLAW 的「system prompt」概念混淆 → **Mitigation**：文档与 UI 标明 CONFIG「模板」仅静态文本；字段名为 `prompt`。  
- **[Risk]** 旧客户端未知 `kind=template` → **Mitigation**：新 kind；老客户端若只读列表需忽略未知 kind 或展示原始 JSON（按现有行为）。  
- **[Trade-off]** 模板不附带变量占位符语法 → 首版保持纯字符串，后续可加。

## Migration Plan

- 无存量 `template` 数据：直接发布 Gateway + agent-core + 前端 + 生成器。  
- 回滚：去掉校验分支与 UI；已创建的 template Skill 可保留在 DB 中由旧版本忽略或手工改 kind（按运维策略）。

## Open Questions

- 工具返回是否需与用户语言环境包装一层 `message` 字段（可与现有 extended skill 返回格式对齐时在实现阶段决定）。  
- 是否在 Skill Hub 为模板类单独图标/筛选（可在实现任务中可选）。
