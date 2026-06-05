## MODIFIED Requirements

### Requirement: Skill Listing
The Skill Hub SHALL list all available skills using a two-level model: base type (such as API or SSH) and optional preset/profile label, including the built-in skill generator.

#### Scenario: List Built-in Skills
- **WHEN** the Skill Hub is opened
- **THEN** a section "Built-in Skills" is displayed
- **AND** it lists "Interface calls (API)", "Calculation (Compute)", and "Skill Generator" (or equivalent name)

#### Scenario: List Extended Skills with canonical type labels
- **WHEN** the Skill Hub is opened
- **THEN** the system fetches skills from the backend
- **AND** a section "Extended Skills" is displayed listing the fetched skills
- **AND** each CONFIG skill displays canonical base type (`api` or `ssh`) rather than legacy `time`/`monitor` as a standalone type label

#### Scenario: Display preset/profile for predefined scenarios
- **WHEN** a listed skill uses a predefined scenario template (for example current-time or server-status)
- **THEN** the UI displays that preset/profile as auxiliary information under the canonical base type
