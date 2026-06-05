## Context

当前 Agent 通过 Java Skill Gateway 的 `/api/skills/ssh` 与 `/api/skills/api` 提供 SSH 与 API 调用能力。Agent Core 在 `agent.ts` 中硬编码 `JavaSshTool`、`JavaApiTool`，并可选注入 `SkillManager.getLangChainTools()`。计算类请求（时间戳转日期、四则运算、阶乘、平方、开方）目前无法由 Agent 可靠执行，需在 Java 端新增专用运算服务。

## Goals / Non-Goals

**Goals:**

- 在 Java Skill Gateway 中新增 `/api/skills/compute` 端点，支持时间戳转 YYYY-MM-DD、加减乘除、阶乘、平方、开方
- 在 Agent Core 中新增 `JavaComputeTool`，与现有 Java 工具一致地调用该端点
- 在 Agent 的 tool 列表中暴露计算 Skill 的描述，使 LLM 能正确识别并调用

**Non-Goals:**

- 不实现复杂表达式解析（如 `"1+2*3"`），仅支持结构化请求
- 不扩展为通用计算器（三角函数、对数等），本阶段仅覆盖上述运算
- 不修改 SkillManager 或 SKILL.md 流程，计算能力以 Java Tool 形式提供

## Decisions

### 1. 请求格式：结构化 JSON

**决策**：使用 `{ "operation": "add|subtract|multiply|divide|factorial|square|sqrt|timestamp_to_date", "operands": [a, b, ...] }` 格式。

**理由**：LLM 易于生成结构化 JSON，便于校验与防注入。替代方案（自然语言解析）实现复杂且易出错。

### 2. 时间戳转日期：毫秒级 Unix 时间戳

**决策**：`operation: "timestamp_to_date"`，`operands: [timestamp_ms]`，返回 `YYYY-MM-DD` 字符串。

**理由**：与 JavaScript `Date` 及常见 API 一致。若需秒级时间戳，可由前端或 Agent 先乘 1000。

### 3. 运算实现位置：Java Skill Gateway

**决策**：在 `SkillController` 中新增 `@PostMapping("/compute")`，或新建 `ComputeController` 挂载于 `/api/skills/compute`。

**理由**：与现有 `/api/skills/ssh`、`/api/skills/api` 模式一致，复用认证与安全策略。Java 端可统一做数值范围与类型校验。

### 4. Agent 侧集成：新增 JavaComputeTool

**决策**：在 `java-skills.ts` 中新增 `JavaComputeTool`，在 `agent.ts` 的 tools 数组中注册。

**理由**：与 `JavaSshTool`、`JavaApiTool` 一致，无需改动 SkillManager。Tool 的 `description` 字段即作为 Agent skill 描述，LLM 通过 tool schema 可见。

### 5. Skill 描述注入方式

**决策**：通过 `JavaComputeTool` 的 `description` 字段提供。可选在 agent 指令中增加一句「你还有 compute 工具可执行数学运算与日期转换」，但不强制。

**理由**：LangChain 会将所有 tool 的 description 暴露给 LLM，无需额外修改 `buildSkillPromptContext`。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 阶乘/开方输入过大导致性能或溢出 | 对 operands 做合理上限（如阶乘 n≤170，开方仅接受非负） |
| LLM 传错 operation 或 operands 类型 | 服务端校验并返回明确错误信息 |
| 与现有 api_caller 功能重叠 | compute 专注数学/日期，api_caller 用于通用 HTTP；职责清晰 |
