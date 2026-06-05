package com.lobsterai.skillgateway.dto;

/**
 * Public LLM settings for GET /api/user/{id}/llm-settings (no API key plaintext).
 */
public class LlmSettingsResponse {
    public String apiBase;
    public String modelName;
    public boolean hasApiKey;
    /** True when merged user + server env yields a non-empty API key (for enabling avatar generate, etc.). */
    public boolean hasEffectiveApiKey;

    public LlmSettingsResponse() {
    }

    public LlmSettingsResponse(String apiBase, String modelName, boolean hasApiKey, boolean hasEffectiveApiKey) {
        this.apiBase = apiBase;
        this.modelName = modelName;
        this.hasApiKey = hasApiKey;
        this.hasEffectiveApiKey = hasEffectiveApiKey;
    }
}
