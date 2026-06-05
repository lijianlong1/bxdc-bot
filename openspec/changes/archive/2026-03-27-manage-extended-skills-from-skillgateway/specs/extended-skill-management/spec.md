## ADDED Requirements

### Requirement: Extended Skill Management Interface
The system SHALL provide a user interface to manage Extended Skills, including creation, modification, deletion, and toggling their enabled state.

#### Scenario: Open Skill Management
- **WHEN** user clicks the "Manage" button in the Skill Hub's Extended Skills section
- **THEN** a Skill Management modal/dialog opens, displaying a list of current Extended Skills with actions to edit, delete, or toggle status

#### Scenario: Create New Extended Skill
- **WHEN** user clicks "Add Skill" in the Skill Management interface
- **AND** fills in the required fields (name, description, configuration JSON) and submits
- **THEN** the new skill is saved via the backend API and appears in the list

#### Scenario: Edit Existing Extended Skill
- **WHEN** user clicks "Edit" on an existing skill
- **AND** updates the fields and submits
- **THEN** the skill details are updated via the backend API

#### Scenario: Toggle Skill Status
- **WHEN** user toggles the enabled switch for a skill
- **THEN** the skill's enabled status is updated via the backend API
