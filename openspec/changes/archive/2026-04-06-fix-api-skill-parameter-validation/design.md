## Context

目前，系统依赖大模型根据提供的描述来生成 API skill 的参数。然而，大模型经常无法生成严格遵守已定义 JSON schema (`parameterContract`) 的参数。这导致 API 请求格式错误（例如：缺少必填字段、类型不正确或忽略默认值）。系统当前缺乏在发送请求之前对这些参数进行校验的机制，从而导致 API 调用失败和用户体验不佳。

## Goals / Non-Goals

**Goals:**
- 确保大模型在调用 API skill 时接收到清晰全面的参数 schema 信息。
- 在执行 API 调用之前，针对 skill 的 `parameterContract` 对大模型生成的参数实施严格校验。
- 在校验失败时向大模型提供结构化的错误反馈，使其能够纠正参数。

**Non-Goals:**
- 除了添加校验步骤外，修改实际的 API 执行逻辑。
- 更改 `parameterContract` 本身的结构。

## Decisions

1.  **参数校验库**: 我们将使用 `ajv` (Another JSON Schema Validator) 来校验大模型生成的参数是否符合 `parameterContract`。它是 Node.js 中用于 JSON schema 校验的标准且高性能的库。
    *   *Rationale*: `ajv` 被广泛使用，支持 JSON Schema Draft 7（通常用于这些契约），并提供详细的错误信息，可以反馈给大模型。
2.  **校验位置**: 校验将发生在 `backend/agent-core/src/tools/java-skills.ts` 中的 `executeConfiguredApiSkill` 函数（或类似的 API skill 中心执行点）中，就在实际发出 HTTP 请求之前。
    *   *Rationale*: 这确保了所有 API skill 调用都被校验，无论它们是如何触发的。
3.  **错误处理与反馈**: 如果校验失败，工具执行将抛出一个包含 `ajv` 具体校验失败信息的错误。该错误将被 agent 框架捕获并作为工具的输出返回给大模型，提示其使用更正后的参数重试。
    *   *Rationale*: 这创建了一个自我纠正的循环，大模型可以从错误中学习并调整其输出以匹配所需的 schema。
4.  **提示词增强**: 提示词生成逻辑（可能在 `buildGeneratedSkill` 中）将被更新，以确保清晰地向大模型呈现 `parameterContract`，例如在工具描述中明确提及必填字段、类型和默认值。

## Risks / Trade-offs

-   **Risk**: 如果 schema 过于复杂或错误信息不够清晰，大模型可能会陷入校验失败的死循环。
    *   *Mitigation*: 确保从 `ajv` 返回的错误信息格式清晰简洁，以便大模型能够轻松理解需要修复的内容。
-   **Trade-off**: 添加校验会为每次 API 调用增加少量开销。
    *   *Mitigation*: `ajv` 经过高度优化，与网络请求本身相比，其开销可以忽略不计。
