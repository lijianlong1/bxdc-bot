# skill-discovery Specification

## Purpose
TBD - created by archiving change manage-extended-skills-from-skillgateway. Update Purpose after archive.
## Requirements
### Requirement: Dynamic Skill Discovery
The Agent Core SHALL dynamically discover and load available Extended Skills from the SkillGateway at startup or upon request, rather than relying on hardcoded lists. The set of loaded skills MUST be limited to skills visible to the **current session user** per `skill-visibility` rules: all `PUBLIC` extended skills plus `PRIVATE` skills whose creator matches that user.

#### Scenario: Load Skills on Startup
- **WHEN** the Agent Core initializes
- **THEN** it calls the SkillGateway API (e.g. `GET /api/skills`) with user identity consistent with the chat session
- **AND** it receives only skills visible to that user
- **AND** it registers the skills with `enabled=true` and `type='EXTENSION'` as available tools in its cognitive loop

#### Scenario: Handle Fetch Failure
- **WHEN** the Agent Core fails to fetch skills from SkillGateway during initialization
- **THEN** it logs an error and continues to start with only Built-in skills available

#### Scenario: Parse Skill Configuration
- **WHEN** the Agent Core receives a skill from SkillGateway
- **THEN** it parses the `configuration` JSON to determine the specific tool execution logic (e.g., specific API endpoint or script to run)

#### Scenario: Private skills of other users are not loaded
- **WHEN** another user has created `PRIVATE` extended skills
- **THEN** the Agent Core MUST NOT register those skills for the current session user

### Requirement: 扩展 Skill 注册与路由策略衔接

SkillGateway 返回并注册的 EXTENSION 技能（见既有 **Dynamic Skill Discovery**）SHALL 作为 Agent **扩展 Skill 优先**策略（`agent-extended-skill-priority`）中「已加载工具集合」的唯一来源；实现 SHALL 确保加载失败的技能不会出现在「优先使用」列表中。

#### Scenario: 注册失败不宣称可用

- **WHEN** 某扩展 Skill 因网关错误或权限未出现在当前会话工具列表中
- **THEN** 路由策略 SHALL NOT 指示模型调用该名称
