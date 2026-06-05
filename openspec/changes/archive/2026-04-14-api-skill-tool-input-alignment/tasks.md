## 1. Agent Core — documentation and messages

- [x] 1.1 Prepend `input`-envelope hint in `appendParameterContractToToolDescription` (before Parameters / JSON Schema dump).
- [x] 1.2 Extend `REQUIRE_PARAMETERS` `message` for API skills with an explicit `input` envelope example.
- [x] 1.3 Implement `recoverDynamicToolInputFromRunConfig` and call it at the start of the extension `DynamicTool` `func` so empty `input` can be recovered from `runConfig.toolCall.args`.

## 2. Skill generation

- [x] 2.1 In `deriveSkillDescription` for `targetType === "api"`, append guidance to pass parameters as JSON serialized into the tool `input` string.

## 3. Verification

- [x] 3.1 Run `npm run build` in `backend/agent-core` (or project-standard check).
