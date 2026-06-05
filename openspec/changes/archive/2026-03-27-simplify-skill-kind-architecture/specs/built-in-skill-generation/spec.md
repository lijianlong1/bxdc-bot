## MODIFIED Requirements

### Requirement: Generate SSH Skill
The built-in skill generator SHALL support generating `CONFIG` type skills using canonical `kind=ssh`, and SHALL encode scenario intent (such as server status inspection) via preset/profile metadata and corresponding command fields.

#### Scenario: Generate SSH skill from description
- **WHEN** the user provides a description of a script or command to run on a server
- **THEN** the generator outputs a canonical SSH configuration with `kind=ssh` and the appropriate `command`
- **AND** the generator sets the matching preset/profile for the described scenario
- **AND** the system saves this skill to the SkillGateway

### Requirement: Multi-type Generation Tool
The system SHALL provide a unified `JavaSkillGeneratorTool` (or equivalent) that can determine the target skill type (`api`, `ssh`, or `openclaw`) from the user's intent and generate the corresponding canonical configuration.

#### Scenario: Agent selects appropriate generation type
- **WHEN** the user asks to create a skill
- **THEN** the Agent uses the `JavaSkillGeneratorTool`
- **AND** the tool correctly infers the `targetType` based on whether the task is an API call, a server command, or a complex planning task
- **AND** for CONFIG mode, generated output uses canonical kinds (`api`/`ssh`) plus preset/profile metadata where needed
