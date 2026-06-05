## ADDED Requirements

### Requirement: Skill Hub Visibility
The system SHALL provide a visible mechanism to access the Skill Hub from the main chat interface.

#### Scenario: Open Skill Hub
- **WHEN** user clicks the "SkillHub" button in the chat interface
- **THEN** the Skill Hub drawer/modal opens

### Requirement: Skill Listing
The Skill Hub SHALL list all available skills, categorized by type.

#### Scenario: List Built-in Skills
- **WHEN** the Skill Hub is opened
- **THEN** a section "Built-in Skills" is displayed
- **AND** it lists "Interface calls (API)" and "Calculation (Compute)"

#### Scenario: List Extended Skills
- **WHEN** the Skill Hub is opened
- **THEN** the system fetches skills from the backend
- **AND** a section "Extended Skills" is displayed listing the fetched skills

### Requirement: Skill Details
The Skill Hub SHALL display the name and description for each skill.

#### Scenario: View Skill Info
- **WHEN** a skill is listed in the Skill Hub
- **THEN** its name and description are visible
