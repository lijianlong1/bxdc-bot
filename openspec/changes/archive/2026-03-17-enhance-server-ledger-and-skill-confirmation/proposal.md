## Why

Currently, users must rely on IP addresses to identify servers in the ledger, which is not user-friendly. Additionally, high-risk skills like SSH execution run immediately upon Agent decision, lacking a safety mechanism to prevent accidental or unauthorized operations. A "human-in-the-loop" confirmation step is needed for critical actions to ensure safety and user control.

## What Changes

- **Server Ledger**: Add a `name` field to the `ServerLedger` entity to allow users to alias their servers.
- **Skill Metadata**: Add a `requiresConfirmation` attribute to the `Skill` entity.
- **New Skill**: Implement a `server-lookup` built-in skill that allows the Agent to retrieve server connection details by name.
- **Confirmation Flow**: Implement a mechanism where skills marked with `requiresConfirmation` (like SSH) pause execution and request user approval via the UI before proceeding.
- **Frontend**: Update the Server Ledger UI to manage server names and add a confirmation dialog in the chat interface.

## Capabilities

### New Capabilities
- `server-ledger-enhancement`: Add `name` field to server ledger and update management APIs.
- `skill-confirmation`: Implement the `requiresConfirmation` attribute for skills and the corresponding agent-frontend confirmation flow.
- `server-lookup-skill`: A new built-in skill to resolve server details (IP, username, etc.) from a server name.

### Modified Capabilities
- `ssh-skill`: Update the SSH skill to require user confirmation before execution and support using the `server-lookup` capability.

## Impact

- **Database**: Schema updates for `server_ledgers` (new column) and `skills` (new column).
- **Backend**: Updates to `ServerLedgerController`, `SkillController`, and `AgentController`.
- **Agent**: Logic to handle `requiresConfirmation` flag and suspend/resume execution.
- **Frontend**: New UI for server names and confirmation requests.
