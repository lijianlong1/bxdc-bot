## 1. Agent Core：`parameterBinding: formBody`

- [x] 1.1 在 `ExtendedSkillConfig` 与 `normalizeParameterBindingValue` 中增加 `formBody`，并更新与 `isMethodAllowingJsonBodyBinding` 等价的 **「允许以 body 承载契约标量」** 辅助函数（`formBody` 与 `jsonBody` 在 POST/PUT/PATCH/DELETE 上同权；GET/HEAD 回退行为与现网 `jsonBody` 一致）。
- [x] 1.2 在 `executeConfiguredApiSkill` 中：在 `formBody` 且方法允许时，复用/对齐 `mergeJsonBodyForProxy` 的合并结果，将**平面**对象序列化为 `application/x-www-form-urlencoded` 字符串；若合并对象含嵌套对象/数组，按 spec **不发请求**并返回可纠错错误。
- [x] 1.3 增加 `mergeHeadersForApiProxy` 的并列逻辑（或重命名/拆分）：在 `formBody` 且未显式提供 `content-type` 时默认 `application/x-www-form-urlencoded`；不与 `jsonBody` 的默认 JSON 头冲突。
- [x] 1.4 更新内置技能生成/提示文案中关于 `parameterBinding` 的说明（若有硬编码 `query`/`jsonBody` 列表处）。
- [x] 1.5 为 `formBody` 路径增加/扩展单元测试（含：表单字符串、`Content-Type`、GET/HEAD 回退、非平面值拒绝）；运行现有 `java-skills` 相关测试。

## 2. 前端：编辑与解析

- [x] 2.1 将 `ApiParameterBinding` 扩展为含 `formBody`；`readParameterBinding` / `serializeSkillDraft` 与校验提示同步更新。
- [x] 2.2 在 `SkillManagementModal.vue`（或实际承载 API 绑定选项的 UI）中增加 **Form body / 表单 Body** 选项，与 `query` / `jsonBody` 一致交互。
- [x] 2.3 更新 `skillEditor.test.ts` 中关于 `parameterBinding` 的解析/序列化用例。

## 3. Skill Gateway（按需）

- [x] 3.1 联调确认 `ApiProxyService` + `RestTemplate` 对 `String` body 与 `Content-Type: application/x-www-form-urlencoded` 的转发；若存在 converter 问题，在 `ApiProxyService` 或 `BuiltinToolExecutionService` 中做**最小**修复并补充测试。

## 4. 收尾

- [x] 4.1 全量自测：保存含 `formBody` 的 API Skill、执行一次对 mock/真实仅接受 form 的上游；确认与未改 `query` / `jsonBody` 的 Skill 行为无回归。
