# api-extension-skill-llm-tool-call

## Purpose

Define how extension **API** skills are presented to the LLM as tools and how the agent MUST avoid tool-call retry loops when the model mis-encodes parameters.

## ADDED Requirements

### Requirement: Tool description matches single input parameter

The system MUST present extension API skills to the LLM with documentation that is consistent with the tool schema: all parameters described in the contract MUST be passed as **one JSON string** in the tool’s `input` parameter unless a later change explicitly migrates to structured tools.

#### Scenario: Description instructs input envelope

- **WHEN** an extension API skill is registered as a LangChain tool with a single `input: string` parameter
- **THEN** the tool description visible to the LLM MUST state that contract fields are provided inside that stringified JSON object assigned to `input`
- **AND** the description MUST NOT imply that contract fields are separate top-level function arguments

### Requirement: Progressive disclosure teaches correct encoding

When the agent returns `REQUIRE_PARAMETERS` for an API skill, the response MUST include explicit guidance that the **next** tool call MUST use the `input` string to carry the JSON object, including a minimal example of the envelope shape.

#### Scenario: Second call after REQUIRE_PARAMETERS

- **WHEN** the LLM receives a `REQUIRE_PARAMETERS` payload for an API skill
- **THEN** the message MUST include an example of nesting serialized JSON under `input`
- **AND** the LLM MUST be able to complete a successful call without contradicting the tool schema

### Requirement: Recovery from flat tool arguments

When the serialized `input` is empty or equivalent to an empty object, the system MUST recover parameter data if the runtime tool call arguments object contains flat keys or a string `input`, by merging those values into the same normalization path used for successful API invocation.

#### Scenario: Flat args present when input is empty

- **WHEN** the tool implementation receives an empty or whitespace-only `input` string, or a string that parses to `{}`
- **AND** the tool runtime exposes original call arguments with contract keys not nested under `input`, or a usable `input` string in `args`
- **THEN** the system MUST merge those arguments into the payload used for validation and HTTP execution
- **AND** the system MUST NOT discard non-empty `input` in favor of flat args
