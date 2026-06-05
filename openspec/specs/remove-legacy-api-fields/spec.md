# remove-legacy-api-fields Specification

## Purpose
TBD - created by archiving change remove-legacy-api-fields. Update Purpose after archive.
## Requirements
### Requirement: Remove Legacy API Fields
The system SHALL NOT include `apikey`, `apikeyField`, `autoTimestampField`, or `responseWrapper` in the API skill configuration.

#### Scenario: User creates a new API skill
- **WHEN** user opens the skill management modal to create a new API skill
- **THEN** the form does not display fields for API Key, API Key Field, Auto Timestamp Field, or Response Wrapper
- **AND** the saved configuration does not contain these fields

#### Scenario: User edits an existing API skill with legacy fields
- **WHEN** user edits an existing API skill that previously had `apikey`, `apikeyField`, `autoTimestampField`, or `responseWrapper`
- **THEN** the form does not display these fields
- **AND** when the user saves the skill, these legacy fields are removed from the saved configuration

#### Scenario: Agent executes an API skill
- **WHEN** the agent executes an API skill
- **THEN** the backend execution logic does not attempt to read or append `apikeyField` or `autoTimestampField` to the request
- **AND** the backend execution logic does not attempt to unwrap the response using `responseWrapper`

