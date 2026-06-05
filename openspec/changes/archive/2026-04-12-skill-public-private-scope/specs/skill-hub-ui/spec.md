## MODIFIED Requirements

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

## ADDED Requirements

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
