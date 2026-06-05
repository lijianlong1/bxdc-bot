## Context

The API skill configuration currently includes legacy fields: `apikey`, `apikeyField`, `autoTimestampField`, and `responseWrapper`. With the recent refactoring of the API skill flow (which introduced `interfaceDescription` and `parameterContract`), these dedicated fields are redundant and clutter the UI. The `interfaceDescription` is now intended to carry all necessary instructions for the LLM regarding authentication and parameter requirements.

## Goals / Non-Goals

**Goals:**
- Remove the legacy fields (`apikey`, `apikeyField`, `autoTimestampField`, `responseWrapper`) from the frontend UI (`SkillManagementModal.vue`).
- Remove these fields from the frontend data models (`ApiConfigDraft`, `ExtendedSkillConfig` equivalent).
- Update frontend parsing and serialization logic (`skillEditor.ts`) to ignore these fields.
- Update backend models (`ExtendedSkillConfig`, `SkillGeneratorInput`) to remove these fields.
- Update backend execution logic (`java-skills.ts`) to stop processing `apikey`, `apikeyField`, and `autoTimestampField` during API requests.
- Ensure all tests pass without these fields.

**Non-Goals:**
- Modifying the behavior of other skill types (e.g., SSH, OPENCLAW).
- Changing the newly introduced `interfaceDescription` or `parameterContract` logic.

## Decisions

1.  **Remove fields from `ApiConfigDraft` and `API_ALLOWED_KEYS`**: We will directly remove `apikey`, `apikeyField`, `autoTimestampField`, and `responseWrapper` from the frontend types and serialization logic. This ensures they are no longer saved.
2.  **Remove UI elements**: The corresponding `<t-form-item>` elements in `SkillManagementModal.vue` will be deleted.
3.  **Update backend `ExtendedSkillConfig`**: The interface in `java-skills.ts` will be updated to remove these fields.
4.  **Simplify `executeConfiguredApiSkill`**: The logic that checks for `config.apiKeyField` and `config.autoTimestampField` and appends them to the URL search params will be removed. The LLM is now responsible for providing all necessary parameters (including keys if needed, based on the `interfaceDescription`) via the `parameterContract`.
5.  **Update Tests**: Any tests that explicitly set or check for these legacy fields (e.g., in `skillEditor.test.ts` and `java-skills.loader.test.cjs`) will be updated to remove them.

## Risks / Trade-offs

-   **Risk**: Existing skills in the database might still have these fields in their JSON configuration.
    -   **Mitigation**: The parsing logic (`parseApiDraft`) will simply ignore these unknown keys, which is safe. When the skill is next edited and saved, the fields will be dropped from the JSON. The backend execution logic will also ignore them if they happen to be present in the parsed config object.
-   **Risk**: Existing skills that relied on the backend automatically appending the `apikey` or `autoTimestampField` will break if the LLM doesn't know to provide them.
    -   **Mitigation**: Users will need to update the `interfaceDescription` and `parameterContract` of those specific skills to instruct the LLM to provide the necessary authentication parameters. This is an expected consequence of this cleanup and aligns with the new schema-driven approach.