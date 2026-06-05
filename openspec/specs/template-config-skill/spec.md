# template-config-skill Specification

## Purpose
CONFIG-mode extended skills with canonical `kind=template` store a single user-facing prompt for reuse; agent-core exposes them as tools without HTTP or SSH execution.

## Requirements

### Requirement: Template CONFIG Skill model

The system SHALL support a CONFIG-mode extended skill whose canonical configuration kind is `template`, and whose stored `configuration` object SHALL contain exactly one normative text field `prompt` (the user-facing 「提示词」), and SHALL NOT require API or SSH specific fields for validation when `kind` is `template`.

#### Scenario: Persist template skill

- **WHEN** a user or generator creates an extended skill with `executionMode` CONFIG and `configuration` containing `"kind": "template"` and a non-empty `prompt` string
- **THEN** the system persists the skill successfully through SkillGateway
- **AND** no `method`, `endpoint`, or SSH `command` fields are required for validation

#### Scenario: Reject empty prompt

- **WHEN** a create or update request uses `kind=template` with missing or whitespace-only `prompt`
- **THEN** the system rejects the request with a validation error

### Requirement: Template skill runtime exposure

The agent extended-skill loader SHALL register a tool for each enabled template skill and SHALL return a deterministic payload that includes the template `prompt` when the tool is invoked (for example a JSON object including `kind` and `prompt`), so downstream agent logic can consume the text without ambiguity with HTTP response bodies.

#### Scenario: Invoke template tool

- **WHEN** the model invokes the tool bound to a template CONFIG skill with valid credentials
- **THEN** the tool result includes the stored `prompt` in a structured form agreed by the agent-core implementation
- **AND** the result does not perform network or SSH execution
