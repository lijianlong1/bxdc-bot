## MODIFIED Requirements

### Requirement: API Skill Invocation

The system MUST invoke the configured API skill using the parameters provided by the LLM after applying the same **normalization** rules as the agent runtime (including unwrapping a JSON string from `input` when used, and recovery of equivalent flat arguments from the tool call when documented for extension API skills).

#### Scenario: Successful invocation

- **WHEN** the LLM generates valid parameters for an API skill after normalization
- **THEN** the system executes the API request with the normalized parameters
- **AND** the system returns the API response to the LLM

#### Scenario: Failed invocation (validation error)

- **WHEN** the LLM generates invalid parameters for an API skill (e.g., missing required fields, type mismatch, enum violation) after normalization
- **THEN** the system MUST NOT execute the API request
- **AND** the system MUST return a structured error message to the LLM indicating the validation failures
- **AND** the LLM CAN attempt to correct the parameters and invoke the skill again
