## Context

当前系统已经有一个 `JavaApiSkillGeneratorTool` 作为一个 built-in skill，允许 Agent 在对话中根据用户的 API 描述自动生成 `CONFIG` 类型的 API skill 并保存、验证。
但是，这个生成器在前端的 Skill Hub 中是不可见的（前端目前只硬编码了 `api` 和 `compute` 两个 built-in skill 的展示）。
此外，当前系统支持 `CONFIG` 类型的 SSH skill 和 `OPENCLAW` 类型的自主规划 skill，但生成器尚未支持这两种类型的生成。

## Goals / Non-Goals

**Goals:**
- 扩展 `JavaApiSkillGeneratorTool`（或重命名/新增 tool）以支持生成 `CONFIG` (SSH) 和 `OPENCLAW` 类型的 skill。
- 将 built-in skill 的列表在前端 Skill Hub 中正确展示，包括这个生成器本身，让用户能直观看到“我可以通过对话生成 skill”的能力。
- 确保生成不同类型的 skill 时，能够提供正确的配置结构（例如 SSH 需要 `command`，OPENCLAW 需要 `systemPrompt` 和 `allowedTools`）。

**Non-Goals:**
- 不改变 SkillGateway 的后端存储结构（继续复用 `configuration` JSON 字段）。
- 不改变现有的 `OPENCLAW` 串行执行引擎，仅负责正确生成其配置。

## Decisions

1. **重命名并扩展生成器 Tool**
   - **决定**：将现有的 `JavaApiSkillGeneratorTool` 重构或重命名为 `JavaSkillGeneratorTool`，使其成为一个通用的 skill 生成器。
   - **理由**：单一的生成器入口更容易让模型理解“当用户想创建技能时，调用这个工具”。通过参数或多轮对话来区分要生成的具体类型（API, SSH, OPENCLAW）。
   - **替代方案**：为每种类型创建一个独立的生成器 Tool（如 `JavaSshSkillGeneratorTool`）。这样会导致 built-in tools 数量膨胀，且模型在选择时可能混淆。

2. **生成器 Tool 的输入协议设计**
   - **决定**：生成器的输入参数需要支持多态。例如，增加一个 `targetType` 字段（`api`, `ssh`, `openclaw`）。根据 `targetType` 的不同，要求不同的必填字段（如 API 需要 `endpoint`，SSH 需要 `command`，OPENCLAW 需要 `systemPrompt`）。
   - **理由**：强类型约束可以利用 LLM 的 function calling 能力，减少生成错误配置的概率。

3. **验证策略的适配**
   - **决定**：
     - API 类型：保持现有的验证逻辑（调用 `/api/skills/api`）。
     - SSH 类型：调用 `/api/skills/ssh` 进行验证，可能需要提示用户提供 serverId 或在验证时 mock 一个安全的 echo 命令。
     - OPENCLAW 类型：由于其依赖其他工具，验证时可以尝试用一个简单的 prompt 触发其内部的 planner，或者仅做配置格式校验。
   - **理由**：不同类型的 skill 验证成本和前置条件不同，需要分类处理。

4. **前端 Skill Hub 列表展示**
   - **决定**：在 `frontend/src/composables/useSkillHub.ts` 的 `BUILT_IN_SKILLS` 列表中，显式加入这个“技能生成器”的条目，并配以合适的图标和描述。
   - **理由**：这是最直接满足“在 skill 列表中能看到”需求的方式。

## Risks / Trade-offs

- **[Risk] OPENCLAW 技能生成的 allowedTools 可能不存在** → **Mitigation**: 生成器在构建配置时，应通过系统提示词要求 LLM 只能从当前已知的工具列表中选择 `allowedTools`，或者在后端保存前校验这些 tools 是否存在。
- **[Risk] SSH 技能验证可能带来安全风险** → **Mitigation**: 生成器在试跑验证 SSH skill 时，可以要求必须在受限的测试服务器上运行，或者默认跳过高危命令的自动验证，仅做语法检查。
