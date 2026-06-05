## MODIFIED Requirements

### Requirement: Skill Listing
The Skill Hub SHALL list all available skills, categorized by type, including the built-in skill generator.

#### Scenario: List Built-in Skills
- **WHEN** the Skill Hub is opened
- **THEN** a section "Built-in Skills" is displayed
- **AND** it lists "Interface calls (API)", "Calculation (Compute)", and "Skill Generator" (or equivalent name)

#### Scenario: List Extended Skills
- **WHEN** the Skill Hub is opened
- **THEN** the system fetches skills from the backend
- **AND** a section "Extended Skills" is displayed listing the fetched skills
