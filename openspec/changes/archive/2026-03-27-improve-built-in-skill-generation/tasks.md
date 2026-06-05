## 1. Built-in Skill Generator Extension

- [x] 1.1 Rename `JavaApiSkillGeneratorTool` to `JavaSkillGeneratorTool` in `backend/agent-core/src/tools/java-skills.ts` and update its description to cover API, SSH, and OPENCLAW generation.
- [x] 1.2 Update the input schema of `JavaSkillGeneratorTool` to accept a `targetType` (api, ssh, openclaw) and make fields like `endpoint`, `command`, `systemPrompt` conditionally required based on the type.
- [x] 1.3 Implement the configuration generation logic for `targetType: 'ssh'`, outputting `kind: 'ssh'` and the required `command`.
- [x] 1.4 Implement the configuration generation logic for `targetType: 'openclaw'`, outputting `executionMode: 'OPENCLAW'`, `systemPrompt`, and an empty or inferred `allowedTools` list.
- [x] 1.5 Update the validation logic in `JavaSkillGeneratorTool` to handle SSH (e.g., mock validation or skip) and OPENCLAW (e.g., format validation).
- [x] 1.6 Update `AgentFactory` in `backend/agent-core/src/agent/agent.ts` to register the renamed `JavaSkillGeneratorTool`.

## 2. Frontend Skill Hub Updates

- [x] 2.1 Add the `JavaSkillGeneratorTool` (Skill Generator) to the `BUILT_IN_SKILLS` array in `frontend/src/composables/useSkillHub.ts` with an appropriate icon and description.

## 3. Testing and Verification

- [x] 3.1 Update existing tests in `backend/agent-core/test/java-skills.loader.test.cjs` to use the new `JavaSkillGeneratorTool` name.
- [x] 3.2 Add a test case for generating an SSH skill configuration.
- [x] 3.3 Add a test case for generating an OPENCLAW skill configuration.
