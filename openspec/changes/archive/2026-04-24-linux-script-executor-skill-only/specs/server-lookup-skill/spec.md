## MODIFIED Requirements

### Requirement: Server Lookup Skill
The system SHALL provide a built-in skill **named per implementation** (e.g. `server_lookup`) that, given a **`serverName`**, returns **up to five (5)** **relevance-ordered** candidate entries for the **current user’s** server ledger. Each entry SHALL include a **`serverId`** and **MAY** include **`label`** or similar display metadata. The system SHALL **NOT** return **passwords**, private keys, or a **full connection string** for the LLM to open raw SSH. The HTTP/API and Zod schema for the lookup request SHALL use the parameter name **`serverName`** (a deprecated alias **`name`** MAY be supported for one release only).

#### Scenario: Lookup yields up to five candidates
- **WHEN** the Agent calls the server-lookup tool with a non-empty `serverName` that matches zero or more ledger records under the product’s matching rules
- **THEN** the response includes a **`candidates` array** with **length 0 to 5**
- **AND** each element includes **`serverId`**
- **AND** the next step for execution is **`linux_script` / `linux_script_executor`** with **`serverId`**, not IP-based SSH from the model

#### Scenario: Exactly one candidate
- **WHEN** the lookup returns **exactly one** candidate
- **THEN** the Agent **MAY** treat that **`serverId`** as the selected target **without** an extra user pick step (while MAY still restate the choice to the user)
- **AND** the response format SHALL make single-candidate cases unambiguous (e.g. `candidates` length 1 and/or `count: 1`)

#### Scenario: Two to five candidates
- **WHEN** the lookup returns **two or more** candidates
- **THEN** the Agent **MUST** obtain **user confirmation** (or an explicit disambiguation choice) to select one **`serverId`** before calling **`linux_script_executor` / extended execute**
- **AND** the system MUST NOT auto-select among multiple distinct `serverId` values

#### Scenario: No match
- **WHEN** the Agent calls the server-lookup tool with a `serverName` that matches no record within the top-five relevance window
- **THEN** the system returns an empty or error result suitable for the Agent to ask the user to refine the name
- **AND** the response MUST NOT fabricate a `serverId`

## REMOVED Requirements

### Requirement: Server Lookup Integration
**Reason**: The old scenario described IP-based SSH chaining from the model; the integration requirement is replaced by a two-tool flow (`server_lookup` then `linux_script`) described in `linux-script-executor-skill-only`.

**Migration**: Agent system prompts and tools SHALL state: (1) call lookup with **`serverName`** to obtain up to **five** `serverId` candidates, (2) if one candidate, proceed with that **`serverId`**, (3) if several, user confirms, (4) then call **`linux_script_executor` / extended skills** with **`serverId`** and the skill’s **`command`**.

## ADDED Requirements

### Requirement: Server lookup is not optional for ad-hoc server names
When the user refers to a server by **name** and a **`serverId` is not already unambiguous in context**, the Agent SHOULD call **server-lookup** before executing Linux script skills, except where the user explicitly provided a **`serverId`**.

#### Scenario: Name without id
- **WHEN** the user says “on **prod-api**” and no **`serverId`** is in context
- **THEN** the Agent SHOULD use server lookup with **`serverName`** first
- **AND** if exactly one candidate is returned, the Agent MAY immediately use that **`serverId`** for `linux_script`
- **AND** if two or more candidates are returned, the Agent MUST confirm with the user before execution

### Requirement: Authenticated user scope
The server-lookup tool SHALL only return `serverId`s for servers visible to the **current authenticated user** (same scoping as the server ledger for that user).

#### Scenario: Other user’s servers invisible
- **WHEN** a `serverName` would only match another user’s ledger
- **THEN** the system behaves as no match or access denied per product policy
- **AND** no foreign `serverId` is leaked
