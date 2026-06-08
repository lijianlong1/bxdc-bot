## Context

`java-skills.ts` 是 Agent 端 skill 工具集合文件，经过多轮迭代已达 ~2900 行。上一轮重构中确认了架构原则——Agent 不包含定制化逻辑，不同类型 skill 的定制开发均在 Java/Gateway 内实现。当前文件仍有大量旧架构遗留代码需要清理。

**当前架构**：Extension Skill 统一通过 `POST /api/skills/execute` 执行，Gateway 内部按 `kind`（api/ssh/template）分发。

**死代码来源**：旧架构下 Agent 需要理解 API skill 的参数契约、拼接 URL/Header/Body，直接调 Gateway 的 `/api/skills/api`。这些逻辑现在已被 `POST /api/skills/execute` 统一入口替代。

**SSH 工具冗余**：`JavaSshTool`（ssh_executor）、`JavaLinuxScriptTool`（linux_script_executor）与 SSH Extension Skill（`kind: "ssh"`）功能重叠——本质上都是 SSH 到服务器执行命令。

## Goals / Non-Goals

**Goals:**
- 删除 `executeConfiguredApiSkill` 及其下游依赖函数链（约 18 个函数）
- 删除废弃的 preset 专属函数（`executeCurrentTimeSkill`、`executeServerResourceStatusSkill` 等）
- 删除 `JavaSshTool` 和 `JavaLinuxScriptTool`，SSH 操作统一走 SSH Extension Skill
- 将 Skill 生成代码拆分到 `tools/skill-generator.ts`
- 将 OPENCLAW 代码拆分到 `tools/openclaw-executor.ts`
- 更新保留代码的注释

**Non-Goals:**
- 不改变 Extension Skill 的执行流程
- 不改动 Gateway 端代码
- 不新增功能
- 不将 Built-in 工具（compute、server_lookup、skill_generator）动态化加载（那是未来工作）

## Decisions

### D1: SSH 工具删除范围

**决策**：同时删除 `JavaSshTool` 和 `JavaLinuxScriptTool`。

**理由**：
- SSH Extension Skill（`kind: "ssh"`）通过服务器台账连接，支持动态传入 `host`/`id` 和 `command`
- `JavaLinuxScriptTool` 的功能完全被 SSH Extension Skill 覆盖
- `JavaSshTool` 允许直连任意服务器（传入 host/username/password），不依赖台账。但若用户所有服务器都已录入台账，此路径多余
- 保留旧入口会增加维护负担和用户困惑

**替代方案**：
- 方案 B：只删 `JavaLinuxScriptTool`，保留 `JavaSshTool`。被拒绝，因为多入口维护成本高。

### D2: 文件拆分边界

**决策**：创建两个新文件。
- `tools/skill-generator.ts`：`JavaSkillGeneratorTool`、`buildGeneratedSkill`、`saveGeneratedSkill`、`deriveSkillName`、`deriveSkillDescription`、`buildValidationSummary`、`sanitizeConfigForDisplay` 及相关 schema
- `tools/openclaw-executor.ts`：`executeOpenClawSkill`、`resolveAllowedTools`、`invokeToolDirect`、`summarizeToolResult`、`tryParseJson`

**理由**：这两个模块与核心 skill 执行流程正交，各自独立且代码量大，适合单独维护。

### D3: 死代码删除的确认标准

**决策**：通过全局搜索确认函数没有被引用后删除。对于 `export` 的函数，检查 dist 文件和外部 import。对于内部函数，检查文件内调用链。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 其他文件引用了被删除的 export 函数 | 编译/运行时错误 | 删除前全局搜索引用 |
| SSH 工具删除后 LLM 无法执行 SSH 命令 | 用户功能受阻 | 确保 SSH Extension Skill 完整可用 |
| `AGENT_EXPOSE_SSH_EXECUTOR` 环境变量被使用 | 部署配置失效 | 在 agent.ts 中同步清理该环境变量逻辑 |
| `legacy` dispatch 模式依赖被删除的函数 | legacy 模式失效 | 本次不考虑 legacy 兼容，legacy 模式将逐步废弃 |
