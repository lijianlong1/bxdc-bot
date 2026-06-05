## 1. 类型与配置解析

- [x] 1.1 在 `ExtendedSkillConfig` 中增加 `parameterBinding?: "query" | "jsonBody"`（或设计稿中的最终命名），并在 `normalizeExtendedConfig` / `parseSkillConfig` 路径中正确保留与校验取值
- [x] 1.2 如需 skill 生成器占位，在 `buildGeneratedSkill` 或相关文档字段中说明 POST JSON 场景可选用 `jsonBody`（最小改动，可仅注释或 `interfaceDescription` 模板）

## 2. 执行路径：executeConfiguredApiSkill

- [x] 2.1 抽取或内联「合并后参与 HTTP 的标量字段」构建逻辑，区分 **query 模式** 与 **jsonBody** 模式：后者将扁平字段组装为 object 作为代理 `body`，且不把同名字段写入 URL query
- [x] 2.2 处理 `merged.body` 与扁平字段的合并策略（与设计一致：建议浅合并，body 覆盖）
- [x] 2.3 在 `jsonBody` + POST/PUT/PATCH 下，若 `headers` 未包含 `Content-Type`，补充 `application/json`（用户已配置则不覆盖）

## 3. 边界与回归

- [x] 3.1 实现 GET + `jsonBody` 的回退策略（query 或 noop），并避免异常
- [x] 3.2 在 `backend/agent-core/test/java-skills.loader.test.cjs`（或等价测试）增加：扁平契约 + POST + `parameterBinding: "jsonBody"` 时，断言发往 `/api/skills/api` 的 payload 中 `body` 正确、URL 无错误 query

## 4. 收尾

- [x] 4.1 本地跑通相关测试套件；必要时更新 `openspec/specs/api-skill-invocation/spec.md` 主分支（由 apply/archive 流程执行时同步）
