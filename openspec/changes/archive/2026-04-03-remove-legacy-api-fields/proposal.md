## Why

The current API skill form contains legacy fields (`apikey`, `apikeyField`, `autoTimestampField`, `responseWrapper`) that are no longer needed. The API key information is now intended to be included in the new `interfaceDescription` field. Removing these legacy fields simplifies the form, reduces confusion, and aligns with the new progressive disclosure and schema-driven approach for API skills.

## What Changes

- Remove `apikey` field from the API skill configuration form and backend models.
- Remove `apikeyField` (key) field from the API skill configuration form and backend models.
- Remove `autoTimestampField` (时间戳) field from the API skill configuration form and backend models.
- Remove `responseWrapper` (响应包装字段) field from the API skill configuration form and backend models.
- Update frontend parsing, serialization, and UI components to exclude these fields.
- Update backend skill execution logic to no longer process or append these fields to requests/responses.
- Update skill generator tools and tests to reflect the removal of these fields.

## Capabilities

### New Capabilities

- `remove-legacy-api-fields`: Simplifies the API skill configuration by removing deprecated fields (apikey, apikeyField, autoTimestampField, responseWrapper).

### Modified Capabilities

- `refactor-api-skill-flow`: The previous flow introduced `interfaceDescription` which now fully supersedes the need for dedicated `apikey` fields.

## Impact

- **Frontend**: `SkillManagementModal.vue`, `skillEditor.ts`, and related tests will be updated to remove the legacy fields.
- **Backend**: `java-skills.ts`, `java-skills.loader.test.cjs`, and any other files handling `ExtendedSkillConfig` for API skills will be updated to ignore/remove these fields. The execution logic will no longer append API keys or timestamps automatically based on these fields.