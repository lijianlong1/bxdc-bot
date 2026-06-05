# extended-skill-management Specification

## Purpose
TBD - created by archiving change manage-extended-skills-from-skillgateway. Update Purpose after archive.
## Requirements
### Requirement: Extended Skill Management Interface
The system SHALL provide a user interface to manage Extended Skills, including creation, modification, deletion, and toggling their enabled state. The management list and actions SHALL only include skills the current user is allowed to manage: **private** skills are manageable **only by their creator**; **public** skills are manageable **only by their creator** (same write policy as `skill-visibility` for `PUBLIC` updates and deletes).

#### Scenario: Open Skill Management
- **WHEN** user clicks the "Manage" button in the Skill Hub's Extended Skills section
- **THEN** a Skill Management modal/dialog opens, displaying a list of Extended Skills the user may manage, with actions to edit, delete, or toggle status where permitted

#### Scenario: Create New Extended Skill
- **WHEN** user clicks "Add Skill" in the Skill Management interface
- **AND** fills in the required fields (name, description, configuration JSON, and visibility) and submits
- **THEN** the new skill is saved via the backend API with the current user as creator
- **AND** the new skill appears in the list according to its visibility

#### Scenario: Edit Existing Extended Skill
- **WHEN** user clicks "Edit" on a skill they are allowed to manage
- **AND** updates the fields and submits
- **THEN** the skill details are updated via the backend API

#### Scenario: Toggle Skill Status
- **WHEN** user toggles the enabled switch for a skill they are allowed to manage
- **THEN** the skill's enabled status is updated via the backend API

#### Scenario: Cannot manage another user's private skill
- **WHEN** user B attempts to edit, delete, or toggle a `PRIVATE` skill owned by user A
- **THEN** the UI MUST NOT offer successful completion of that action
- **AND** the backend MUST reject unauthorized updates

#### Scenario: Cannot manage another user's public skill
- **WHEN** user B attempts to edit, delete, or toggle a `PUBLIC` skill created by user A
- **THEN** the UI MUST NOT offer successful completion of that action
- **AND** the backend MUST reject unauthorized updates

### Requirement: 固定管理员对平台 public 行的管理入口

当当前登录用户 ID 为 **`890728`**（与 `skill-visibility` 中硬编码管理员一致）时，界面 SHALL 对 `createdBy` 为平台作者 `public` 的扩展 Skill 提供与创建者相同的编辑、删除、启用切换能力（以网关写权限为准）。其他用户对此类行 MUST 为只读。

#### Scenario: 管理员 890728 可管理平台行
- **WHEN** 当前用户 ID 为 `890728`
- **AND** 列表中存在 `createdBy` 为 `public` 的扩展 Skill
- **THEN** 界面 MUST 允许对该行执行允许的写操作（与后端一致）

#### Scenario: 非管理员对平台行只读
- **WHEN** 当前用户 ID 不是 `890728`
- **AND** 列表中存在 `createdBy` 为 `public` 的扩展 Skill
- **THEN** 界面 MUST NOT 提供成功的编辑、删除或破坏性操作（或仅展示只读）

