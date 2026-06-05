# skill-hub-ui Specification

## Purpose
TBD - created by archiving change add-skill-hub. Update Purpose after archive.
## Requirements
### Requirement: Skill Hub Visibility
The system SHALL provide a visible mechanism to access the Skill Hub from the main chat interface.

#### Scenario: Open Skill Hub
- **WHEN** user clicks the "SkillHub" button in the chat interface
- **THEN** the Skill Hub drawer/modal opens

### Requirement: Skill Listing
The Skill Hub SHALL list available skills using a two-level model: base type (such as API or SSH) and optional preset/profile label, including the built-in skill generator. **Extended Skills** listed in the Hub SHALL be only those **visible to the current user** (per `skill-visibility`: all `PUBLIC` extended skills plus the current user's `PRIVATE` skills).

#### Scenario: List Built-in Skills
- **WHEN** the Skill Hub is opened
- **THEN** a section "Built-in Skills" is displayed
- **AND** it lists "Interface calls (API)", "Calculation (Compute)", and "Skill Generator" (or equivalent name)

#### Scenario: List Extended Skills with canonical type labels
- **WHEN** the Skill Hub is opened
- **THEN** the system fetches skills from the backend for the current user
- **AND** a section "Extended Skills" is displayed listing only the fetched visible skills
- **AND** each CONFIG skill displays canonical base type (`api` or `ssh`) rather than legacy `time`/`monitor` as a standalone type label

#### Scenario: Display preset/profile for predefined scenarios
- **WHEN** a listed skill uses a predefined scenario template (for example current-time or server-status)
- **THEN** the UI displays that preset/profile as auxiliary information under the canonical base type

#### Scenario: Other users' private skills are not listed
- **WHEN** another user has `PRIVATE` extended skills
- **THEN** the current user's Skill Hub MUST NOT list those skills

### Requirement: Built-in 区块为公共平台技能且作者为 public
Skill Hub 的 **Built-in** 区块 SHALL 仅展示平台内置能力（如 Interface calls、Calculation、Skill Generator）；这些项 SHALL 在语义上为 **公共** Skill，归属作者为 **`public`**，SHALL NOT 作为当前登录用户的私人扩展 Skill 展示。

#### Scenario: 内置区块不随用户私人列表隐藏
- **WHEN** 任意已认证用户打开 Skill Hub
- **THEN** Built-in 区块 MUST 展示约定的内置项
- **AND** 这些项的呈现方式 MUST 表明其为平台公共能力（作者/归属为 `public` 或与后端一致之等价展示）

#### Scenario: 内置与扩展列表语义分离
- **WHEN** 用户查看 Built-in 与 Extended Skills 两区块
- **THEN** Extended Skills 仅含数据库中对该用户可见的扩展 Skill
- **AND** Built-in 区块所含项 MUST NOT 依赖 `createdBy` 为当前用户才显示

### Requirement: Skill Details
The Skill Hub SHALL display the name, description, and execution type for each database-backed skill.

#### Scenario: View Skill Info
- **WHEN** a skill is listed in the Skill Hub
- **THEN** its name and description are visible

#### Scenario: View Database Skill Type
- **WHEN** a database-backed skill is listed in the Skill Hub
- **THEN** its execution type is visible alongside or near the skill information
- **AND** the type label is consistent with backend-provided metadata

### Requirement: Skill 管理入口支持结构化维护
Skill Hub 的管理入口 SHALL 打开一个面向数据库 Skill 的结构化维护窗口，而不是仅提供原始 JSON 编辑方式。

#### Scenario: 打开 Skill 管理窗口
- **WHEN** 用户从 Skill Hub 进入 Skill 管理界面
- **THEN** 系统打开 Skill 管理窗口
- **AND** 该窗口提供按执行类型切换的结构化维护表单

#### Scenario: 切换执行类型
- **WHEN** 用户在 Skill 管理窗口中切换 `CONFIG` 与 `OPENCLAW` 执行类型
- **THEN** 系统切换到对应类型的结构化编辑区域
- **AND** 不继续显示单一的原始 JSON 文本框作为主要编辑方式

### Requirement: Skill 管理窗口展示协议化字段
Skill Hub 的管理窗口 SHALL 根据 Skill 执行类型展示匹配的协议字段，帮助用户理解当前维护对象。

#### Scenario: 展示 CONFIG 协议字段
- **WHEN** 管理窗口正在编辑一个 `CONFIG` Skill
- **THEN** 界面显示该 Skill 对应的结构化配置字段
- **AND** 用户可以从字段标签理解配置含义

#### Scenario: 展示 OPENCLAW 协议字段
- **WHEN** 管理窗口正在编辑一个 `OPENCLAW` Skill
- **THEN** 界面显示提示词、允许工具列表和编排相关字段
- **AND** 提示词输入区支持多行 Markdown 文本

