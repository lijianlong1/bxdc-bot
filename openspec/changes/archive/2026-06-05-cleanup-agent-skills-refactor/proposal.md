## Why

`java-skills.ts` 经过多轮迭代已膨胀至约 2900 行，累积了大量旧架构遗留的死代码（~22 个函数/类，约占总行数 30%），且 SSH 操作存在多个冗余入口（`JavaSshTool`、`JavaLinuxScriptTool` 与 SSH Extension Skill 功能重叠），增加了维护成本和认知负担。需清理冗余、拆分文件、更新注释，使代码库更清晰可维护。

## What Changes

- **删除死代码**：移除 `executeConfiguredApiSkill`、`executeConfiguredApiSkillAsync` 及其下游依赖函数（旧架构 Agent 侧拼 HTTP 请求的逻辑，现已被 `POST /api/skills/execute` 统一入口替代）
- **删除冗余预设函数**：移除 `executeCurrentTimeSkill`、`executeServerResourceStatusSkill`、`isCurrentTimeSkillConfig`、`isServerMonitorSkillConfig` 等已废弃的 preset 专属执行函数
- **移除冗余 SSH 工具**：删除 `JavaSshTool`（ssh_executor）和 `JavaLinuxScriptTool`（linux_script_executor），确保所有 SSH 操作统一通过 SSH Extension Skill（`POST /api/skills/execute`）单一路径实现 —— **BREAKING**
- **文件拆分**：
  - 将 Skill 生成相关代码（`buildGeneratedSkill`、`saveGeneratedSkill`、`JavaSkillGeneratorTool` 等）拆分到 `tools/skill-generator.ts`
  - 将 OPENCLAW 相关代码（`executeOpenClawSkill`、`resolveAllowedTools`、`invokeToolDirect` 等）拆分到 `tools/openclaw-executor.ts`
- **注释更新**：对保留代码的 JSDoc 和行内注释进行更新，确保准确反映当前架构

## Capabilities

### New Capabilities
- `cleanup-dead-code`: 删除 Agent 端不再需要的旧 API Skill 直连执行路径及冗余预设函数
- `consolidate-ssh-execution`: 统一 SSH 执行路径，移除 `ssh_executor` 和 `linux_script_executor` 内置工具，仅保留 SSH Extension Skill

### Modified Capabilities
<!-- 本次为纯清理重构，不改变功能需求规格 -->

## Impact

- `backend/agent-core/src/tools/java-skills.ts`：主要改动文件，约删除 800-1000 行代码
- `backend/agent-core/src/tools/skill-generator.ts`：新增文件，存放 Skill 生成相关代码
- `backend/agent-core/src/tools/openclaw-executor.ts`：新增文件，存放 OPENCLAW 子规划相关代码
- `backend/agent-core/src/agent/agent.ts`：需移除对 `JavaSshTool`、`JavaLinuxScriptTool` 的注册
- `backend/agent-core/src/tools/tool-trace-context.ts`：OPENCLAW 引用的 trace 工具函数路径可能需调整
- 前端无需改动（SSH 操作对 LLM 透明，工具列表前端不硬编码）
