## ADDED Requirements

### Requirement: Complete Chinese translation of skill generator policy
The system SHALL provide a Chinese (Simplified) translation of the skill generator policy prompt that is semantically equivalent to the English version.

#### Scenario: Chinese skill generator policy content
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `zh`
- **WHEN** the system loads the skill generator policy prompt
- **THEN** the prompt SHALL be in Chinese and SHALL convey:
  - The requirement to verify no existing capability can complete the task before using skill_generator
  - The exception for when the user explicitly asks to create a skill
  - The preference for existing tools over creating new ones

#### Scenario: Chinese policy includes markdown formatting
- **GIVEN** the Chinese skill generator policy is loaded
- **WHEN** examining the prompt content
- **THEN** it SHALL use proper Chinese punctuation and formatting
- **AND** it SHALL maintain the same section structure as the English version

### Requirement: Complete Chinese translation of task tracking policy
The system SHALL provide a Chinese (Simplified) translation of the task tracking policy prompt that accurately describes the multi-task management workflow.

#### Scenario: Chinese task tracking policy enumerates workflow steps
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `zh`
- **WHEN** the system loads the task tracking policy prompt
- **THEN** the prompt SHALL clearly describe in Chinese:
  - Registering sub-tasks with status "pending" or "in_progress" before starting work
  - Marking sub-tasks as "completed" after finishing
  - Marking sub-tasks as "cancelled" if they fail or are no longer needed
  - Not repeating work for already completed tasks
  - Using short, stable task IDs for tracking

#### Scenario: Chinese task status terms match implementation
- **GIVEN** the Chinese task tracking policy references status values
- **WHEN** comparing to the actual TaskStatusValue type definition
- **THEN** the Chinese terms SHALL correspond to: pending（待处理）、in_progress（进行中）、completed（已完成）、cancelled（已取消）

### Requirement: Complete Chinese translation of confirmation UI policy
The system SHALL provide a Chinese (Simplified) translation of the confirmation UI policy that explains the in-app confirmation workflow.

#### Scenario: Chinese confirmation policy explains UI-based approval
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `zh`
- **WHEN** the system loads the confirmation UI policy prompt
- **THEN** the prompt SHALL in Chinese:
  - State that extension skills requiring confirmation and high-risk SSH commands use in-app confirmation buttons
  - Explicitly instruct NOT to tell users to type "yes" or "confirm"
  - Explain that approval is sent via a separate channel after clicking Confirm

#### Scenario: Chinese policy includes risk category examples
- **GIVEN** the Chinese confirmation policy is loaded
- **WHEN** examining the content
- **THEN** it SHALL mention high-risk SSH commands as examples of operations requiring confirmation

### Requirement: Complete Chinese translation of extended skill routing policy
The system SHALL provide a Chinese (Simplified) translation of the extended skill routing policy that explains the preference for extension tools over built-in tools.

#### Scenario: Chinese routing policy explains tool selection hierarchy
- **GIVEN** the `AGENT_PROMPTS_LANGUAGE` environment variable is set to `zh`
- **WHEN** the system loads the extended skill routing policy prompt
- **THEN** the prompt SHALL in Chinese:
  - Instruct to use matching extension tools when available (names starting with "extended_")
  - Explain that extension tools use structured parameters (not single "input" JSON string)
  - State preference for extension SSH skills over built-in ssh_executor
  - Define the three exceptions when built-in tools can be used instead

#### Scenario: Chinese policy explains parameter passing format
- **GIVEN** the Chinese extended skill routing policy references tool parameters
- **WHEN** examining the content
- **THEN** it SHALL clearly state that parameters should be passed as top-level fields per the tool schema

### Requirement: Chinese task summary generation
The system SHALL provide a Chinese version of the task status summary that is injected before each LLM invocation.

#### Scenario: Chinese task summary format
- **GIVEN** there are tasks with various statuses
- **AND** the `AGENT_PROMPTS_LANGUAGE` is set to `zh`
- **WHEN** the system builds the tasks summary for injection into the prompt
- **THEN** the summary SHALL be in Chinese with the format:
  - Header: "[当前任务状态] (completed/total 已完成)"
  - Each task line: "- [status] taskId: taskLabel"
  - Footer instruction about focusing on pending/in_progress tasks

#### Scenario: Chinese status labels in task summary
- **GIVEN** the Chinese task summary is being generated
- **WHEN** displaying task status values
- **THEN** it SHALL use Chinese status labels that correspond to the enum values:
  - pending → 待处理
  - in_progress → 进行中
  - completed → 已完成
  - cancelled → 已取消

### Requirement: Semantic equivalence validation
The system SHALL ensure that Chinese translations are semantically equivalent to their English counterparts.

#### Scenario: Core constraints preserved in translation
- **GIVEN** a Chinese system prompt and its English source
- **WHEN** comparing the constraint descriptions
- **THEN** all SHALL/MUST requirements SHALL be preserved without weakening or strengthening
- **AND** prohibitions ("Do NOT", "never") SHALL be maintained with equivalent strength in Chinese

#### Scenario: Terminology consistency across Chinese prompts
- **GIVEN** multiple Chinese system prompts
- **WHEN** examining references to shared concepts (skills, tools, extensions, confirmations)
- **THEN** the same concept SHALL use consistent Chinese terminology across all prompts
