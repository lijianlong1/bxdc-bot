# cleanup-dead-code

## Purpose
清理 Agent Core 中 `java-skills.ts` 的死代码，删除废弃的 API Skill 执行路径、预设函数、重复代码，拆分文件以降低模块耦合度。

## Requirements

### Requirement: 统一执行入口

系统 SHALL 通过 `POST /api/skills/execute` 作为所有 Extension Skill（API/SSH/Template）的统一执行入口。

Agent SHALL NOT 在本地执行 HTTP 代理或 SSH 命令，所有执行请求转发至 Gateway 处理。

#### Scenario: API Skill 统一执行
- **WHEN** LLM 调用一个 `kind: "api"` 的 Extension Skill
- **THEN** Agent 通过 `POST /api/skills/execute` 发送请求到 Gateway
- **AND** Gateway 内部执行 HTTP 代理并返回结果

### Requirement: 删除废弃的预设专属函数

系统 SHALL 移除以下已废弃的 preset 相关函数，这些函数对应的功能已被统一执行入口替代：
- `executeCurrentTimeSkill`
- `executeServerResourceStatusSkill`
- `isCurrentTimeSkillConfig`
- `isServerMonitorSkillConfig`
- `parseCheckTimePayload`
- `parseSshSkillPayload`

#### Scenario: current-time 类型的 API Skill 正常执行
- **WHEN** LLM 调用一个 current-time preset 的 API Skill
- **THEN** 系统通过统一的 `POST /api/skills/execute` 路径处理
- **AND** Gateway 内部执行 HTTP 代理返回当前时间

### Requirement: 文件拆分

系统 SHALL 将 Skill 生成相关代码拆分到独立文件 `tools/skill-generator.ts`。

包含以下内容：
- `JavaSkillGeneratorTool` 类
- `buildGeneratedSkill` 函数
- `saveGeneratedSkill` 函数
- `deriveSkillName`、`deriveSkillDescription` 函数
- `buildValidationSummary`、`sanitizeConfigForDisplay` 函数
- `normalizeGeneratedOperation` 函数
- 相关 Zod schema（`skillGeneratorToolInputSchema`、`skillGeneratorParameterContractSchema` 等）

#### Scenario: 拆分后 Skill 生成功能正常
- **WHEN** LLM 调用 `skill_generator` 工具创建一个新的 API Skill
- **THEN** 系统从 `skill-generator.ts` 加载工具并执行
- **AND** 生成的结果正确保存到 Gateway

系统 SHALL 将 OPENCLAW 子规划相关代码拆分到独立文件 `tools/openclaw-executor.ts`。

包含以下内容：
- `executeOpenClawSkill` 函数
- `resolveAllowedTools` 函数
- `invokeToolDirect` 函数
- `summarizeToolResult` 函数
- `tryParseJson` 函数

#### Scenario: 拆分后 OPENCLAW Skill 执行正常
- **WHEN** LLM 调用一个 `executionMode: "OPENCLAW"` 的 Skill
- **THEN** 系统从 `openclaw-executor.ts` 加载执行逻辑
- **AND** LLM 子规划正常执行并返回结果

### Requirement: 注释更新

系统 SHALL 更新保留代码中的 JSDoc 和行内注释，以准确反映当前架构状态：
- 更新文件顶部模块职责说明
- 更新 `loadGatewayExtendedTools` 的注释，说明统一执行路径
- 更新 `buildSkillZodSchema` 的注释，说明 parameter contract 不再在 Agent 侧处理
- 更新各 Built-in 工具类的注释，标注其在整体架构中的位置

#### Scenario: 开发者通过注释理解代码
- **WHEN** 新开发者阅读 `java-skills.ts`
- **THEN** 文件顶部注释准确描述了模块职责
- **AND** 函数注释与当前实际行为一致
