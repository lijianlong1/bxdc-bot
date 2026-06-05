## Context

扩展 API Skill 在 agent-core 中由 `executeConfiguredApiSkill` 组装发往 Skill Gateway 的 `POST /api/skills/api` 载荷（`url`、`method`、`headers`、`body`）。`parameterBinding` 已支持 `query` 与 `jsonBody`；网关侧 `ApiProxyService` 将 `body` 与 `Content-Type` 原样交给 `RestTemplate` 转发。许多传统 API 的 POST 仅接受 `application/x-www-form-urlencoded`，与 JSON body 不兼容；当前实现未提供将合并后的契字段**编码为表单**的路径。

## Goals / Non-Goals

**Goals:**

- 在 `ExtendedSkillConfig.parameterBinding` 中增加一种显式模式，使合并后的**平面**标量（及与 `jsonBody` 一致的 `merged.body` 合并语义）在允许的 HTTP 方法下以 **form-urlencoded 字符串**作为出站 body，并默认设置正确的 `Content-Type`。
- 与既有 `query` / `jsonBody` 行为兼容；未改配置的 Skill 行为不变。
- 前端可配置、可序列化存库；具备可自动化测试的契约。

**Non-Goals:**

- 支持 `multipart/form-data` 或文件上传（可后续单独立项）。
- 为嵌套对象/数组定义完整的 bracket 表单项命名标准（MVP 可拒绝非平面值或仅支持字符串化策略并在 spec 中写明）。

## Decisions

1. **绑定名**：采用 `formBody`（与 `jsonBody` 对称、简短）。实现中归一化仅接受小写与文档化别名（若有）的明确集合。

2. **编码方式**：在 Node 侧使用 `URLSearchParams`（或等价的 `application/x-www-form-urlencoded` 序列化）从「合并后的平面对象」生成 body 字符串；键值均为 UTF-8，遵循常见 `x-www-form-urlencoded` 语义。

3. **与 `jsonBody` 的合并逻辑复用**：与 `mergeJsonBodyForProxy` 同源：将 `parameterContract` 合并后的标量与 `merged.body`（对象或可解析为对象的 JSON 字符串）合并为**单一对象**，再序列化为表单；若 `merged.body` 含嵌套结构，MVP 策略为：**拒绝执行**并返回可纠错错误，**或**对嵌套 key 作一次性扁平化（二选一在实现时固定并在 spec 中写死；推荐先 **仅平面标量** 以减小歧义）。

4. **Content-Type 头**：与 `mergeHeadersForApiProxy` 对 JSON 的默认注入类似，在 `formBody` 且未显式设置 `content-type` 时设为 `application/x-www-form-urlencoded`；用户可在 `headers` 中覆盖（若覆盖为其他类型，行为以网关透传为准，文档中提示慎用）。

5. **GET/HEAD 行为**：与 `jsonBody` 一致——不对 GET 强塞 body；`formBody` 在 GET/HEAD 上 **MUST** 回退为 query 或采用与现网 `jsonBody` 等价的明确定义，且不得未捕获异常。

6. **Gateway Java**：优先**无需**改 `ApiProxyService`；联调若发现 `String` body + form `Content-Type` 需显式 `MediaType` 时，再补最小改动。

**Alternatives considered**

- 仅文档要求用户在 `body` 中手写整段 form 字符串：对 LLM 不友好，放弃。
- 用第三方库处理深层嵌套表单：MVP 范围外。

## Risks / Trade-offs

- **[Risk] 非平面 `merged.body` 语义模糊** → **Mitigation**：Spec 中明确仅支持平面标量；复杂结构走专用集成或未来扩展。
- **[Risk] 与某些网关 MessageConverter 不兼容** → **Mitigation**：联调 + 单测/集成测；必要时在 Java 层显式构造 `HttpEntity`。
- **Trade-off**：不支持 multipart，文件类接口需另方案。

## Migration Plan

- 无数据迁移。已有 Skill 未加新字段，行为不变。
- 回滚：撤销代码发布即可；已保存 `parameterBinding: formBody` 的配置在旧版本上可能被视为未知而忽略（视归一化实现而定）——**实现上应**对未知 binding 做安全回退到 `query` 并打日志，或在校验阶段拒绝执行并提示升级 agent-core；设计倾向 **强校验**（非法 binding 报错）更利于排障。

## Open Questions

- 产品侧最终选用 **严格平面** 还是 **浅层对象 flatten**（如 `a.b=1`）作为 MVP 验收标准，可在写 tasks 时与现网 `jsonBody` 对 `body` 的合并行为对齐为「只多一层标量」。
