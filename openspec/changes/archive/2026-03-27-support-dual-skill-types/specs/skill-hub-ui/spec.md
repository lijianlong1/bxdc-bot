## MODIFIED Requirements

### Requirement: Skill Listing
The Skill Hub SHALL list all available skills, categorized by source, and SHALL clearly distinguish database-backed skill execution types.

#### Scenario: List Built-in Skills
- **WHEN** the Skill Hub is opened
- **THEN** a section "Built-in Skills" is displayed
- **AND** it lists "Interface calls (API)" and "Calculation (Compute)"

#### Scenario: List Database Skills
- **WHEN** the Skill Hub is opened
- **THEN** the system fetches skills from the backend
- **AND** a section "Extended Skills" is displayed listing the fetched skills
- **AND** each database-backed skill item displays its execution type

#### Scenario: Distinguish CONFIG and OPENCLAW skills
- **WHEN** the fetched skill list contains both `CONFIG` and `OPENCLAW` database skills
- **THEN** the UI renders a visible type marker, badge, or equivalent text for each skill
- **AND** users can distinguish the two types without opening raw JSON configuration

#### Scenario: Render localized execution type labels
- **WHEN** a database-backed skill has `executionMode=CONFIG`
- **THEN** the UI displays the label `预配置`
- **AND** it does not expose the raw enum value as the primary user-facing label

#### Scenario: Render autonomous planning label
- **WHEN** a database-backed skill has `executionMode=OPENCLAW`
- **THEN** the UI displays the label `自主规划`
- **AND** it does not require users to understand internal enum names

### Requirement: Skill Details
The Skill Hub SHALL display the name, description, and execution type for each database-backed skill.

#### Scenario: View Skill Info
- **WHEN** a skill is listed in the Skill Hub
- **THEN** its name and description are visible

#### Scenario: View Database Skill Type
- **WHEN** a database-backed skill is listed in the Skill Hub
- **THEN** its execution type is visible alongside or near the skill information
- **AND** the type label is consistent with backend-provided metadata
