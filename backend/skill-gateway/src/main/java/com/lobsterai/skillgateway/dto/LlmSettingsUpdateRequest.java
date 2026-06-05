package com.lobsterai.skillgateway.dto;

/**
 * Body for PUT /api/user/{id}/llm-settings.
 * null apiKey means omit from JSON → keep existing; empty string clears stored key.
 */
public class LlmSettingsUpdateRequest {
    public String apiBase;
    public String modelName;
    /** If omitted (null), existing key is kept. If "", stored key is cleared. */
    public String apiKey;
}
