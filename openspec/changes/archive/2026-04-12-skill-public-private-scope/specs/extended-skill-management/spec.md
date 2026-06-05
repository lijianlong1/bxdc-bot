## MODIFIED Requirements

### Requirement: Extended Skill Management Interface

The system SHALL provide a user interface to manage Extended Skills, including creation, modification, deletion, and toggling their enabled state. The management list and actions SHALL only include skills the current user is allowed to manage: **private** skills are manageable **only by their creator**; **public** skills follow the same write policy as defined in `skill-visibility` (e.g. all authenticated users or creator-only, per implementation).

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
