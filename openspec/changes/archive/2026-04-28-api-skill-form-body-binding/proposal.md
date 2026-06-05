## Why

部分上游 HTTP API 的 POST 接口仅接受 `application/x-www-form-urlencoded` 表单体，而当前扩展 API Skill 在「契约字段进 body」路径上仅支持 JSON body（`parameterBinding: jsonBody`），无法将合并后的标量参数编码为表单并附带正确 `Content-Type`，导致这类接口无法被 Skill 正常调用。

## What Changes

- 在 API Skill 的 `configuration`（`ExtendedSkillConfig`）中增加**可选**的 `parameterBinding` 取值（例如 `formBody` 或 `formUrlEncoded`），与既有 `query`、`jsonBody` 并列。
- 当选用该模式且 HTTP 方法为 POST/PUT/PATCH/DELETE 等时，在调用 Skill Gateway 的 `/api/skills/api` 代理前，将合并后的**平面**标量（及与 `jsonBody` 同源的 `merged.body` 合并规则）编码为 **URL 编码表单字符串**，并设置 `Content-Type: application/x-www-form-urlencoded`（若用户未在 `headers` 中显式覆盖）。
- 前端技能编辑（`parameterBinding` 选择）与序列化/解析逻辑同步支持该选项；补充自动化测试与文档化场景。
- **非 BREAKING**：未显式选择新模式时，行为与现网一致。

## Capabilities

### New Capabilities

（无；行为归属既有的 API Skill 出站参数映射。）

### Modified Capabilities

- `api-skill-invocation`：以 **ADDED** delta 增加「form-urlencoded request body 映射」需求与场景（不修改既有 `query` / `jsonBody` 条款正文，以免归档时重复合并）；与 `jsonBody`、默认 `query` 的互斥/回退关系、仅**平面**标量、非平面时拒绝发请求等见 delta spec。

## Impact

- **agent-core**：`backend/agent-core/src/tools/java-skills.ts` 中 `executeConfiguredApiSkill`、`mergeHeaders` 类逻辑、`ExtendedSkillConfig` 类型与配置归一化；相关单元测试。
- **frontend**：`frontend/src/utils/skillEditor.ts`、`SkillManagementModal.vue`（或等价 UI）、`skillEditor.test.ts`。
- **skill-gateway**：如联调发现 `RestTemplate` 对表单字符串与 `Content-Type` 的边角问题，可在 `ApiProxyService` 做小范围补全；默认预期为透传已编码字符串与头即可。
- **OpenSpec**：本变更的 delta spec 归档后需同步到 `openspec/specs/api-skill-invocation/spec.md`（由 apply/归档流程处理）。
