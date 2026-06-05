## ADDED Requirements

### Requirement: System prompts language configuration via environment variable
The system SHALL support configuring the language of system prompts through the `AGENT_PROMPTS_LANGUAGE` environment variable.

#### Scenario: Default language when environment variable is not set
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is not defined
- **WHEN** the agent-core service starts
- **THEN** the system SHALL use English (`en`) as the default language for all system prompts

#### Scenario: Explicit English language selection
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `en`
- **WHEN** the agent-core service starts
- **THEN** the system SHALL load and use English versions of all system prompts

#### Scenario: Chinese language selection
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `zh`
- **WHEN** the agent-core service starts
- **THEN** the system SHALL load and use Chinese (Simplified) versions of all system prompts

#### Scenario: Invalid language value falls back to English
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to an invalid value (e.g., `fr`, `de`, `123`)
- **WHEN** the agent-core service starts
- **THEN** the system SHALL log a warning message and fall back to using English (`en`) language

#### Scenario: Case-insensitive language code matching
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `ZH` or `Zh`
- **WHEN** the agent-core service starts
- **THEN** the system SHALL correctly recognize and use Chinese language prompts (case-insensitive matching)

### Requirement: Language selection is static after startup
The system SHALL determine the language once at startup and SHALL NOT change it during runtime.

#### Scenario: Language remains constant during single session
- **GIVEN** the agent-core service has started with `AGENT_PROMPTS_LANGUAGE=zh`
- **WHEN** multiple agent runs occur within the same process lifetime
- **THEN** all runs SHALL use Chinese system prompts consistently without runtime language switching

### Requirement: Prompts module exposes unified interface
The system SHALL expose all system prompts through a unified `Prompts` module interface, abstracting the underlying language selection.

#### Scenario: Consistent interface regardless of language
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` is set to either `en` or `zh`
- **WHEN** code imports and uses `Prompts` from the prompts module
- **THEN** the interface (property names and types) SHALL be identical regardless of the selected language
- **AND** properties SHALL return strings in the configured language

#### Scenario: Required prompt properties exist
- **GIVEN** any valid language configuration
- **WHEN** accessing the `Prompts` module
- **THEN** the following properties SHALL be available:
  - `skillGeneratorPolicy`: string
  - `taskTrackingPolicy`: string
  - `confirmationUIPolicy`: string
  - `extendedSkillRoutingPolicy`: string
  - `buildTasksSummary`: (tasks: TasksStatusMap) => string
