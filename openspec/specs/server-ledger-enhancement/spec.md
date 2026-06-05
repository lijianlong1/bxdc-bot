## ADDED Requirements

### Requirement: Server Name Field
The system SHALL store a `name` for each server ledger entry.

#### Scenario: Create server with name
- **WHEN** user creates a new server ledger entry with a `name`
- **THEN** the system stores the name and associates it with the server details

#### Scenario: Unique name per user
- **WHEN** user attempts to create a server with a name that already exists for their account
- **THEN** the system rejects the request with a duplicate name error

### Requirement: Server Name Validation
The system SHALL validate that server names are non-empty and conform to a specific format (e.g., alphanumeric, hyphens).

#### Scenario: Invalid name format
- **WHEN** user provides a name with special characters (e.g., "server@1")
- **THEN** the system rejects the request with a validation error

### Requirement: Update Server Name
The system SHALL allow users to update the name of an existing server ledger entry.

#### Scenario: Update name
- **WHEN** user updates the name of an existing server
- **THEN** the system saves the new name

### Requirement: List Servers with Names
The system SHALL include the `name` field in the list of server ledgers returned to the user.

#### Scenario: List servers
- **WHEN** user requests the list of their servers
- **THEN** the response includes the `name`, `ip`, `username` for each server
