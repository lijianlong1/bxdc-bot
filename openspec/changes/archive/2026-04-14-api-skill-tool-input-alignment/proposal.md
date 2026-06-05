## Why

Extension API skills are bound to the LLM as `DynamicTool` with a single function parameter `input: string`, while parameter contracts (`type`, `key`, `page`, …) are appended to the tool **description**. That contradicts the JSON schema the model sees (`properties.input` only), so the same model sometimes emits top-level fields like `{"type":"tiyu"}` instead of nesting JSON inside `input`. LangChain then drops unknown fields, the agent sees empty input, returns `REQUIRE_PARAMETERS`, and the model retries with the same mistake—causing a **retry loop** instead of a successful API call.

## What Changes

- **Agent Core (`java-skills.ts`)**: Document in the tool description that all contract fields MUST be passed as **one JSON string** in `input` (aligned with the exposed schema); do not rely on top-level tool arguments.
- **Agent Core**: Strengthen the `REQUIRE_PARAMETERS` response message with an explicit **`input` envelope example** so the second call uses the correct shape.
- **Agent Core**: When `input` is empty but `runConfig.toolCall.args` contains flat fields matching the contract, **merge** them into the parsed payload so intermittent model behavior does not deadlock.
- **Skill generation (built-in skill_generator)**: When generating or describing API-type extension skills, **bias descriptions** toward the `input` JSON-string contract so newly created skills are self-consistent.

## Capabilities

### New Capabilities

- `api-extension-skill-llm-tool-call`: LLM-facing tool contract for extension API skills—description text, progressive-disclosure responses, and optional runtime normalization MUST align with the single `input: string` parameter and avoid retry loops.

### Modified Capabilities

- `api-skill-invocation`: Clarify that successful invocation applies after **normalization** of tool arguments (serialized `input` and/or equivalent flat fields recovered from the tool call), not only when the raw string matches one historical format.

## Impact

- **Code**: `backend/agent-core/src/tools/java-skills.ts` (primary); possibly built-in skill generator prompts/schemas under `backend/agent-core` if skill generation text is centralized there.
- **Behavior**: No breaking HTTP API; only agent tool-calling and error messages to the LLM change.
- **Dependencies**: None new.
