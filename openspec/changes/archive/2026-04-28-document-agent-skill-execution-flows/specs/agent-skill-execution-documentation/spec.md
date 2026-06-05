# agent-skill-execution-documentation Specification

## Purpose

定义仓库内「Agent 执行各类 Skill 时的逻辑与数据流」说明文档应满足的结构与内容要求，作为本变更的验收依据。

## ADDED Requirements

### Requirement: 主文档存在且可发现

系统 SHALL 在 `docs/agent-skill-execution-flows.md` 提供单一入口的 Markdown 文档，用于说明 Agent Skill 执行流程。

#### Scenario: 文档路径固定

- **WHEN** 贡献者查找 Agent Skill 执行流程说明
- **THEN** 其在 `docs/agent-skill-execution-flows.md` 找到该说明

### Requirement: 工具装配与扩展加载顺序

文档 MUST 说明 `AgentFactory.createAgent` 中工具的注册顺序，包括：built-in 工具（含条件暴露的 `ssh_executor`）、通过 `loadGatewayExtendedTools` 异步加载的 Gateway `EXTENSION` skill、`SkillManager` 可选的文件系统 skill、以及 `ManageTasksTool`。

#### Scenario: 覆盖装配顺序

- **WHEN** 读者阅读「工具如何进入 Agent」章节
- **THEN** 其能理解 `baseTools` 与 `gatewayExtendedTools` 的合并顺序及将 `plannerModel` 传入扩展加载的用途

### Requirement: 四类 Skill 路径均需覆盖

文档 MUST 对以下四类分别给出端到端数据流说明，并与实现对齐：(1) 内置 `skill_generator`（`JavaSkillGeneratorTool`）写入 Skill Gateway；(2) 扩展 CONFIG API skill 经 `executeConfiguredApiSkill` 与 Gateway HTTP 代理；(3) SSH 执行，包括暴露时的 built-in `ssh_executor`，以及 extended 中经台账解析并调用 Gateway SSH 端点的路径；(4) 经由 `executeOpenClawSkill` 的 OPENCLAW / 自主规划（`allowedTools`、串行 orchestration）。

#### Scenario: 四类路径均有独立说明或子节

- **WHEN** 读者需要区分生成器、API、SSH、OPENCLAW
- **THEN** 文档中为每一类提供叙述，并指向主要函数或模块名

### Requirement: 流程图

文档 MUST 包含 Mermaid 图，且至少覆盖：整体工具装配；`loadGatewayExtendedTools` 内 extended skill 的分发分支；带子工具轨迹的 OPENCLAW 内层 planner 循环。

#### Scenario: Mermaid 可渲染

- **WHEN** 在支持 Mermaid 的 Markdown 预览中打开该文档
- **THEN** 上述图表能够渲染且无语法错误

### Requirement: 与实现一致的外部约束

文档 MUST 在适用处说明：`AGENT_EXPOSE_SSH_EXECUTOR` / 未登录会话对 `ssh_executor` 可见性的影响；扩展 skill 确认门与 `confirmed` 标志；Gateway 请求头 `X-Agent-Token` 与可选的 `X-User-Id`。

#### Scenario: 排障相关环境变量被提及

- **WHEN** 读者排查「为何看不到 ssh_executor」
- **THEN** 文档中说明与 `userId` 及环境变量相关的条件
