## Context

- 现状：`executeConfiguredApiSkill` 将合并后的标量字段（除 `query` / `headers` / `body` 外）写入 **URL query**，而发给网关代理的 **body** 仅取 `merged.body`，否则为空字符串。对「扁平 JSON Schema + POST JSON」类接口（如 `/api/auth/register`）会导致 body 为空、字段落在 query 上，上游 400，`RestTemplate` 抛错后表现为网关 500。
- 约束：不能破坏已有依赖 query 传参的 API Skill；配置应落在 Skill 的 `configuration` JSON（`ExtendedSkillConfig`）中，便于生成器与手工编辑。

## Goals / Non-Goals

**Goals:**

- 通过**显式配置**选择：合并后的契约字段映射到 **query**（兼容旧行为）或 **JSON body**。
- 在 **json body** 模式下，将合并对象中应参与 HTTP 的字段序列化为 JSON 作为代理请求的 `body`；**不再**把这些字段写入 URL query（`config.query` / `merged.query` 仍可只用于补充 query）。
- 对 POST/PUT/PATCH 等带 body 的方法，在 json body 模式下默认或推荐附带 `Content-Type: application/json`（可与 skill 已有 `headers` 合并，用户显式覆盖优先）。

**Non-Goals:**

- 不改变 Skill Gateway `ApiProxyService` / `POST /api/skills/api` 的契约。
- 不在本变更中重做整套 skill 生成器 UI；仅保证配置字段可被解析与文档化。
- 不强制改变未配置新字段时的默认策略（保持与当前实现一致）。

## Decisions

1. **配置字段命名**  
   - 采用 `parameterBinding`，取值：`"query"`（默认）| `"jsonBody"`。  
   - **理由**：语义清晰、与 `parameterContract` 并列；默认 `query` 保持向后兼容。  
   - **备选**：仅用 HTTP method 推断（POST 一律 body）— 拒绝，因可能破坏依赖 POST+query 的接口。

2. **jsonBody 模式下 body 的构成**  
   - 从 `merged` 中收集与当前逻辑一致的「契约标量字段」：即原先会进入 query 循环的键值（`query` / `headers` / `body` 保留键除外），组装为**一个 plain object**，作为代理请求的 JSON body；若 `merged.body` 已为 object，**定义合并顺序**为：`flatFields` 与 `merged.body` 深度或浅层合并（设计建议：**浅合并**，`merged.body` 覆盖同名键，以减少意外）。  
   - **理由**：与现有「顶层属性」契约一致，无需强迫用户把 schema 改成嵌套 `body`。

3. **方法范围**  
   - `parameterBinding: "jsonBody"` 在 **GET** 上应视为无效或与规范冲突：实现可 **回退为 query** 并记录日志，或在文档中规定「仅对非 GET 生效」；推荐 **仅对非 GET 应用 jsonBody**，GET 仍走 query 以免语义混乱。

4. **测试**  
   - 在 `java-skills.loader.test.cjs`（或现有 agent-core 测试）中增加：扁平契约 + POST + `parameterBinding: "jsonBody"` 时，发往 gateway 的 payload 中 `body` 为预期 JSON、URL 不含误塞的 query 字段。

## Risks / Trade-offs

- **[Risk] 新旧行为混淆** → 在 skill 文档字符串或 `interfaceDescription` 中说明何时使用 `jsonBody`。  
- **[Risk] 双重 Content-Type** → 合并 `headers` 时若用户未设 `Content-Type`，由实现补默认 `application/json`。  
- **[Trade-off] 默认仍为 query** → 新生成 POST JSON 技能若忘记设 `jsonBody`，问题仍在；可选后续在 **skill 生成器**侧对 `method: POST` 默认写入 `parameterBinding`（本提案 Non-Goal，可在后续 change 做）。

## Migration Plan

- 已有 Skill：不写入新字段 → 行为不变。  
- 需修复的 Skill（如注册）：在 `configuration` 中增加 `"parameterBinding": "jsonBody"` 并保存。

## Open Questions

- `merged.body` 与扁平字段同时存在时，是否允许 `body` 键在 `parameterContract` 中显式声明（当前部分契约无 `body` 属性）— 建议实现阶段采用浅合并并以 `merged.body` 覆盖。
