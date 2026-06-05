# built-in-skill-generation Specification

## ADDED Requirements

### Requirement: Generate Template CONFIG Skill

The built-in skill generator SHALL support generating `CONFIG` type skills with canonical `kind=template`, containing a single generated `prompt` string derived from the user’s description of the reusable template text.

#### Scenario: Generate template skill from description

- **WHEN** the user asks for a reusable prompt-only template or similar intent without HTTP or server command execution
- **THEN** the generator outputs `executionMode=CONFIG` with `configuration` including `"kind": "template"` and a non-empty `prompt`
- **AND** the system saves this skill to the SkillGateway

## MODIFIED Requirements

### Requirement: Multi-type Generation Tool

The system SHALL provide a unified `JavaSkillGeneratorTool` (or equivalent) that can determine the target skill type (`api`, `ssh`, `openclaw`, or `template`) from the user's intent and generate the corresponding canonical configuration.

#### Scenario: Agent selects appropriate generation type

- **WHEN** the user asks to create a skill
- **THEN** the Agent uses the `JavaSkillGeneratorTool`
- **AND** the tool correctly infers the `targetType` based on whether the task is an API call, a server command, a complex planning task, or a prompt-only template
- **AND** for CONFIG mode, generated output uses canonical kinds (`api` / `ssh` / `template`) plus preset/profile metadata where needed for `api` and `ssh`
