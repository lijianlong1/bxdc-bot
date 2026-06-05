# api-extension-skill-llm-tool-call（delta）

本文件为对 `openspec/specs/api-extension-skill-llm-tool-call/spec.md` 的变更增量；归档后合并入主 spec。

## MODIFIED Requirements

### Requirement: Tool description matches single input parameter

The system MUST present extension API skills to the LLM with documentation that is consistent with the tool schema: all parameters described in the `parameterContract` MUST appear as **top-level** fields in the tool’s structured `parameters` (from `DynamicStructuredTool` / Zod), **not** nested inside a single `input` JSON string.

#### Scenario: Description instructs structured fields

- **WHEN** an extension API skill is registered as a LangChain tool with structured parameters
- **THEN** the tool description visible to the LLM MUST list each contract field (or reference the contract) in a way consistent with the OpenAI/LangChain `parameters` schema
- **AND** the description MUST NOT state that contract fields MUST be provided only via a single stringified JSON assigned to `input`

### Requirement: Recovery from flat tool arguments

When structured tool arguments are **empty** or **missing required contract fields**, the system MUST recover parameter data if the runtime tool call arguments object contains flat keys matching the contract **or** legacy nested `input` string, by merging those values into the same normalization path used for successful API invocation.

#### Scenario: Flat args present when structured payload is empty

- **WHEN** the tool implementation receives an empty object or missing required keys after Zod parsing
- **AND** the tool runtime exposes original call arguments with contract keys at the top level, or a legacy string `input` in `args`
- **THEN** the system MUST merge those arguments into the payload used for validation and HTTP execution
- **AND** the system MUST NOT discard non-empty structured fields in favor of empty legacy data without defined precedence

## ADDED Requirements

### Requirement: Full disclosure without REQUIRE_PARAMETERS round-trip

The system MUST NOT rely on a `REQUIRE_PARAMETERS` (or equivalent) **second-call** progressive disclosure flow for API extension skills. The tool’s **description** and structured `parameters` MUST expose **full** contract fields and skill intent in one pass; missing or invalid parameters MUST surface as **Zod** and/or **Ajv** validation errors on the tool result, not as a dedicated “please call again with parameters” empty-handshake response.

#### Scenario: Single-call success path

- **WHEN** the LLM issues a tool call with all required structured fields valid per contract
- **THEN** the system proceeds without requiring a prior `REQUIRE_PARAMETERS` response

#### Scenario: Missing parameters

- **WHEN** required fields are missing or invalid
- **THEN** the system returns validation errors to the LLM
- **AND** MUST NOT require a separate progressive-disclosure round that only returns documentation without executing validation logic

## REMOVED Requirements

### Requirement: Progressive disclosure teaches correct encoding

**Reason**: Replaced by **ADDED** requirement “Full disclosure without REQUIRE_PARAMETERS round-trip”; `REQUIRE_PARAMETERS` round-trip removed per product decision.

**Migration**: Callers rely on Zod/Ajv errors and full tool schema; no second-step `input` envelope.
