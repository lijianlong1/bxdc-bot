## Why

当前扩展 API Skill 在执行 `POST`/`PUT` 等带 JSON body 的接口时，`parameterContract` 中**顶层**标量字段会被并入 URL query，而实际 HTTP body 仅使用 `merged.body`，导致常见契约（如扁平的 `id`/`nickname`/`systemAdminPassword`）无法进入请求体，上游返回 400；网关 `RestTemplate` 再抛错表现为 500。需要通过**可配置**的方式，让调用方明确「契约字段映射到 JSON body」，以支持注册类 POST 与自测场景。

## What Changes

- 在 API Skill 配置（`configuration` JSON / `ExtendedSkillConfig`）中增加**可选**字段，用于声明 `parameterContract` 与 HTTP **body** 的绑定策略（例如：将合并后的顶层字段序列化为 JSON body，而不是写入 query）。
- Agent Core 中 `executeConfiguredApiSkill`（及与之共享合并逻辑的路径）在发起 `POST ${gateway}/api/skills/api` 前，按该策略构造 `body`、**不再**把应属于 body 的字段误放入 query。
- 保持默认行为与现有 GET 为主、query 传参的 Skill **兼容**（显式配置才切换 body 模式），**非 BREAKING**。
- 补充/更新自动化测试（含扁平契约 + POST 的回归）。

## Capabilities

### New Capabilities

（无独立新 capability；行为归属既有「API Skill 调用」语义。）

### Modified Capabilities

- `api-skill-invocation`：增加「可配置 body 传参」的规范性要求与场景，明确 POST JSON 与 `parameterContract` 的映射关系。

## Impact

- **代码**：`backend/agent-core/src/tools/java-skills.ts`（`executeConfiguredApiSkill`、配置解析与归一化）；可能涉及 `ExtendedSkillConfig` 类型与 skill 生成器默认值说明。
- **契约**：已存于网关 DB 的 Skill 在未加新字段时行为不变。
- **文档**：OpenSpec 归档后同步 `openspec/specs/api-skill-invocation/spec.md`（由 apply 流程处理）。
