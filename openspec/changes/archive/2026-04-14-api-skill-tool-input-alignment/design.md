## Context

Extension skills from Skill Gateway use LangChain `DynamicTool`: the OpenAI-style tool schema exposes only `input: string`. Parameter contracts are appended to `description` via `appendParameterContractToToolDescription`. Models sometimes follow the description (flat keys) instead of the schema (nested JSON in `input`), which LangChain strips before `_call`, yielding empty input and `REQUIRE_PARAMETERS` loops.

## Goals / Non-Goals

**Goals:**

- Align **schema** (`input`) and **documentation** (parameter list) so the model is steered toward one encoding.
- Provide a **recovery path** when the model sends flat args in `toolCall.args` (merge into the same pipeline as `normalizeApiSkillPayload`).
- Keep changes localized to agent-core and skill-generation copy; no gateway API changes.

**Non-Goals:**

- Replacing `DynamicTool` with `DynamicStructuredTool` for every extension skill (larger refactor; out of scope for this change).
- Changing Skill Gateway persistence or `parameterContract` JSON Schema format.

## Decisions

1. **Description prefix**  
   Before the "Parameters:" block (and before the JSON Schema dump fallback), prepend a short English instruction: all listed fields MUST be passed as **one JSON object serialized to a string** assigned to **`input`**, not as separate function properties. Rationale: matches the only property in the tool schema; minimal code change.

2. **`REQUIRE_PARAMETERS` message**  
   Append one line with a concrete example of the `input` envelope (escaped JSON in the message string) so the second turn cannot repeat the same mistake.

3. **Runtime fallback**  
   If `input` is empty or parses to `{}` after `parseToolInput`, read `runConfig.toolCall.args`: if `input` is a non-empty string, use it; else if other keys exist, `JSON.stringify` the remainder and use as `execInput`. Rationale: fixes intermittent drops without teaching every model.

4. **Skill generator**  
   Extend `deriveSkillDescription` for `targetType === "api"` so generated descriptions mention passing parameters as a JSON string in the tool `input` argument.

## Risks / Trade-offs

- [Over-merge] → Mitigation: only apply fallback when parsed payload is effectively empty; do not override non-empty `input` strings.
- [Prompt length] → Mitigation: keep prefix + example to one or two sentences each.

## Migration Plan

Deploy agent-core only; no DB migration. Rollback: revert `java-skills.ts` changes.

## Open Questions

- None blocking; structured-tool migration can be a follow-up change.
