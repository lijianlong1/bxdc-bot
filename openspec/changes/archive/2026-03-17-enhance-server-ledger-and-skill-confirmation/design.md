## Context

The current system allows users to manage server ledgers (IP, username, password) and execute SSH commands via the `ssh_executor` tool. However, servers are identified only by IP, which is inconvenient. Furthermore, the `ssh_executor` runs immediately upon invocation by the Agent, posing a risk of accidental execution of destructive commands. We need to introduce server aliases and a human-in-the-loop confirmation mechanism.

## Goals / Non-Goals

**Goals:**
- Enable users to assign names to servers and use these names in natural language instructions.
- Implement a `server-lookup` skill to resolve server names to connection details.
- Enforce a user confirmation step for sensitive skills (specifically SSH) before execution.
- Provide a clear UI summary of the action to be confirmed.

**Non-Goals:**
- Implementing a complex role-based access control (RBAC) system for skills (beyond simple user isolation).
- changing the underlying SSH connection mechanism (SSHJ).

## Decisions

### 1. Server Ledger Enhancement
- **Schema**: Add `name` (VARCHAR) to `server_ledgers` table.
- **Constraint**: Unique constraint on `(user_id, name)` to ensure unique aliases per user.
- **API**: Update CRUD endpoints to handle the `name` field.

### 2. Skill Confirmation Mechanism
- **Skill Entity**: Add `requires_confirmation` (BOOLEAN, default false) to the `Skill` entity in Java.
- **Dynamic Skills**: Support `requires_confirmation: true` in `SKILL.md` frontmatter.
- **Agent-Side Logic**:
    - Update `JavaSshTool` (and other sensitive tools) schema to accept an optional `confirmed: boolean` parameter.
    - In the tool's `_call` method:
        - If the tool requires confirmation (configured via constructor or metadata) AND `confirmed` is false/undefined:
            - Return a structured string: `CONFIRMATION_REQUIRED: {"summary": "...", "params": {...}}`.
        - If `confirmed` is true:
            - Proceed with execution.
    - **System Prompt**: Update the Agent's system prompt to instruct it: "If a tool returns CONFIRMATION_REQUIRED, show the summary to the user and ask for confirmation. If the user confirms, call the tool again with 'confirmed': true."

### 3. Frontend Interaction
- **Confirmation UI**:
    - The Frontend will parse the Agent's message. If it detects the confirmation request (or if the Agent explicitly asks), it renders a specific "Action Confirmation" card.
    - *Simplification*: The Agent will output a natural language request "Please confirm executing...". The Frontend can rely on the user simply typing "Yes" or clicking a "Confirm" button that sends "Yes".
    - *Enhanced UI*: To satisfy the "dialog box" requirement, we can have the Agent output a special block (e.g., Markdown or a specific tag) that the Frontend renders as a confirmation widget.
    - **Decision**: The Agent will output a specific JSON-like block for confirmation requests:
      ```json
      <confirmation-request>
      {
        "tool": "ssh_executor",
        "summary": "Execute 'ls -la' on server 'web-prod'",
        "data": { ... }
      }
      </confirmation-request>
      ```
      The Frontend will render this as a card with "Confirm" and "Cancel" buttons.
      - "Confirm" sends: "User confirmed."
      - "Cancel" sends: "User cancelled."

### 4. Server Lookup Skill
- **New Tool**: `JavaServerLookupTool` (Node.js) wrapping `GET /api/skills/server-lookup`.
- **Java**: New endpoint in `SkillController` (or `ServerLedgerController`) to find server by name.

## Risks / Trade-offs

- **[Risk] Prompt Injection**: A user could theoretically trick the Agent into bypassing confirmation by saying "I already confirmed".
    - *Mitigation*: The tool itself enforces the check. The `confirmed` param must be passed *to the tool*. The user cannot directly call the tool; only the LLM can. As long as the LLM follows the "ask user first" rule, it's safe.
- **[Risk] Complexity**: The "Ask -> Confirm -> Retry" loop adds latency and token usage.
    - *Trade-off*: Acceptable for high-stakes operations like SSH.

## Migration Plan

1.  **Database**:
    -   `ALTER TABLE server_ledgers ADD COLUMN name VARCHAR(255);`
    -   `UPDATE server_ledgers SET name = ip;` (Default name to IP)
    -   `ALTER TABLE server_ledgers ADD CONSTRAINT uk_user_server_name UNIQUE (user_id, name);`
    -   `ALTER TABLE skills ADD COLUMN requires_confirmation BOOLEAN DEFAULT FALSE;`
2.  **Code**: Deploy Backend (Java) -> Deploy Agent (Node.js) -> Deploy Frontend.

## Open Questions

- Should `server-lookup` also require confirmation?
    - *Decision*: No, it's a read-only operation. Only the subsequent SSH action needs confirmation.
