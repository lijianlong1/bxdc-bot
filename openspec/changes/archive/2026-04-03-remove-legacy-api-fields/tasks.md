## 1. Frontend Updates

- [x] 1.1 Remove `apikey`, `apikeyField`, `autoTimestampField`, and `responseWrapper` from `ApiConfigDraft` interface in `frontend/src/utils/skillEditor.ts`.
- [x] 1.2 Remove the corresponding keys from `API_ALLOWED_KEYS` in `frontend/src/utils/skillEditor.ts`.
- [x] 1.3 Update `parseApiDraft` and `serializeSkillDraft` in `frontend/src/utils/skillEditor.ts` to no longer read or write these fields.
- [x] 1.4 Remove the `<t-form-item>` elements for these four fields from `frontend/src/components/SkillManagementModal.vue`.
- [x] 1.5 Update `frontend/src/utils/skillEditor.test.ts` to remove references to these fields in the test cases.

## 2. Backend Updates

- [x] 2.1 Remove `apiKeyField`, `apiKey`, `autoTimestampField`, and `responseWrapper` from `ExtendedSkillConfig` interface in `backend/agent-core/src/tools/java-skills.ts`.
- [x] 2.2 Remove `apiKeyField`, `apiKey`, `autoTimestampField`, and `responseWrapper` from `SkillGeneratorInput` interface in `backend/agent-core/src/tools/java-skills.ts`.
- [x] 2.3 Update `executeConfiguredApiSkill` in `backend/agent-core/src/tools/java-skills.ts` to remove the logic that appends `apiKeyField` and `autoTimestampField` to the URL search params.
- [x] 2.4 Update `executeConfiguredApiSkill` in `backend/agent-core/src/tools/java-skills.ts` to remove the logic that unwraps the response using `responseWrapper`.
- [x] 2.5 Update `buildGeneratedSkill` in `backend/agent-core/src/tools/java-skills.ts` to no longer process these fields for API skills.
- [x] 2.6 Update `JavaSkillGeneratorTool` description in `backend/agent-core/src/tools/java-skills.ts` to reflect the removal of these fields.

## 3. Testing and Verification

- [x] 3.1 Update `backend/agent-core/test/java-skills.loader.test.cjs` to remove references to these fields in the test cases (e.g., `configured API extended skill builds query and proxies request`).
- [x] 3.2 Run frontend tests (`npm run test` in `frontend`) and ensure they pass.
- [x] 3.3 Run backend tests (`npm run test:tools` in `backend/agent-core`) and ensure they pass.
- [x] 3.4 Build the frontend (`npm run build` in `frontend`) to verify no compilation errors.