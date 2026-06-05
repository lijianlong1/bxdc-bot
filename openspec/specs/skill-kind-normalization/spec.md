# skill-kind-normalization Specification

## Purpose
TBD - created by archiving change simplify-skill-kind-architecture. Update Purpose after archive.
## Requirements
### Requirement: Canonical Skill Kind Model
The system SHALL treat skill `kind` as a base execution type only, and SHALL support `api`, `ssh`, and `template` as canonical values for CONFIG-mode skills.

#### Scenario: Validate canonical kinds
- **WHEN** a CONFIG-mode skill is created or updated with `kind=api`, `kind=ssh`, or `kind=template`
- **THEN** the validation passes if other required fields for that kind are valid

#### Scenario: Reject non-canonical kinds for new writes
- **WHEN** a CONFIG-mode skill is created with `kind=time` or `kind=monitor` (or any value other than `api`, `ssh`, or `template`) outside of documented legacy read paths
- **THEN** the system rejects the write with a validation error indicating non-canonical kind usage

### Requirement: Preset-based Scenario Modeling
The system SHALL model scenario-specific behavior (such as current-time query and server status monitoring) via preset/profile metadata under canonical `kind`, rather than introducing new `kind` values.

#### Scenario: Represent current time as API preset
- **WHEN** a predefined current-time skill is stored
- **THEN** it is stored with `kind=api` and a preset/profile identifying the current-time template

#### Scenario: Represent server monitoring as SSH preset
- **WHEN** a predefined server-status skill is stored
- **THEN** it is stored with `kind=ssh` and a preset/profile identifying the server-status template

### Requirement: Backward Compatibility for Existing Skills
The system SHALL continue to execute existing persisted `time` and `monitor` skills during the migration window, and SHALL provide deterministic mapping rules to canonical `api`/`ssh` representations.

#### Scenario: Read legacy time skill
- **WHEN** the system loads an existing skill with `kind=time`
- **THEN** the skill remains executable and is mapped to the equivalent canonical API preset model in runtime or during save

#### Scenario: Read legacy monitor skill
- **WHEN** the system loads an existing skill with `kind=monitor`
- **THEN** the skill remains executable and is mapped to the equivalent canonical SSH preset model in runtime or during save
