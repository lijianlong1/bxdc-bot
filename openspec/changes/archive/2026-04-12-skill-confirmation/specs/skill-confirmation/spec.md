## MODIFIED Requirements

### Requirement: Confirmation Interruption
The system SHALL pause the execution of a skill that requires confirmation and request approval from the user.

#### Scenario: Agent calls sensitive skill
- **WHEN** the Agent attempts to call a skill marked with `requiresConfirmation` without a confirmation token
- **THEN** the system returns a `CONFIRMATION_REQUIRED` response with a summary of the action and parameters
- **AND** agent-core intercepts this response and sends a `confirmation_request` SSE event to the frontend instead of relying on the LLM to generate user-facing text

### Requirement: User Confirmation UI
The system SHALL present a confirmation card with action buttons to the user when a skill requires approval.

#### Scenario: Display confirmation request
- **WHEN** the agent-core sends a `confirmation_request` SSE event
- **THEN** the frontend renders an inline confirmation card in the chat message area with "Confirm" and "Cancel" buttons
- **AND** the card is bound to the specific `toolCallId` from the SSE event

### Requirement: Resume Execution
The system SHALL allow the agent to resume the skill execution after receiving user confirmation via the REST endpoint.

#### Scenario: User confirms action
- **WHEN** the user clicks the "Confirm" button
- **THEN** the frontend calls `POST /agent/confirm` with `confirmed: true`
- **AND** agent-core re-invokes the same tool with `confirmed: true` and injects the result into the message stream
- **AND** the ReAct loop resumes

#### Scenario: User denies action
- **WHEN** the user clicks the "Cancel" button
- **THEN** the frontend calls `POST /agent/confirm` with `confirmed: false`
- **AND** agent-core injects a "user cancelled" tool message and resumes the ReAct loop
- **AND** the LLM receives the cancellation and responds accordingly
