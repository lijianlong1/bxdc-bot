## 1. Agent 工具注册

- [x] 1.1 在 `backend/agent-core/src/agent/agent.ts` 中删除对 `JavaApiTool` 的 `import` 与 `new JavaApiTool(...)` 注册行；在**原注册处**增加**中文块注释**，说明 built-in `api_caller` **暂时不默认挂载**、`JavaApiTool` 类仍保留在 `java-skills.ts` 供后续恢复或单测/调试、且与扩展 API Skill 的 `executeConfiguredApiSkill` 路线无关。
- [x] 1.2 同步更新 `agent.ts` 文件头注释中列举内置工具时**不再**声明「含 `JavaApiTool` / HTTP API 调用」或改为「`api_caller` 已暂停默认注册（见下）」等一致表述；**不得**从 `java-skills.ts` **删除** `JavaApiTool` 类定义（仅可加强注释）。

## 2. `JavaApiTool` 实现处注释

- [x] 2.1 在 `backend/agent-core/src/tools/java-skills.ts` 的 `JavaApiTool` 类上（或类内首段注释）增加**中文**说明：当前生产默认**不**在 `AgentFactory` 中挂载；与扩展 API Skill 的 `executeConfiguredApiSkill` → `POST /api/skills/api` 路线**独立**；`AGENT_BUILTIN_SKILL_DISPATCH` 仅在该工具被注册时对其出站路径生效。

## 3. 提示词与读者文档

- [x] 3.1 更新 `backend/agent-core/src/prompts/en.ts` 与 `zh.ts` 中列举 `api_caller` 的句子，使部署在未挂载 `api_caller` 时**不自相矛盾**（例如从列表中移除 `api_caller`，或明确「若部署未暴露则忽略该条」）；保持「优先扩展 Skill、勿用其他内置绕过」的语义。
- [x] 3.2 可选：在 `docs/agent-skill-execution-flows.md` 增加**简短**一段，与 OpenSpec `api-skill-invocation` / `agent-builtin-api-caller-policy` .delta 一致，便于读者对照代码路径（若已有等价段落则**仅**在偏差时补一句「默认不注册 `api_caller`」）。

## 4. 测试与构建

- [x] 4.1 运行或补充**最小**单测/快照：若存在「默认 tools 数量/名称」类断言，更新期望集**不含** `api_caller`；对仍直接 `new JavaApiTool` 的隔离单测**保留**。
- [x] 4.2 `agent-core` 构建通过（`tsc` / 项目约定命令）；回归与扩展 API Skill 相关的已有 loader/集成测。

## 5. 归档前校验（本变更合入时）

- [x] 5.1 合入前对照 `openspec/changes/unmount-api-caller-from-agent/specs/**` 与实现做一次自检，确保无「扩展经 `api_caller` 实现」的误述残留。
