package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

import com.lobsterai.skillgateway.util.StringUtils;

@TableName("skills")
public class Skill {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("name")
    private String name;

    @TableField("description")
    private String description;

    @TableField("type")
    private String type; // SSH, API, COMPUTE

    @TableField("configuration")
    private String configuration; // JSON string for configuration

    @TableField("execution_mode")
    private String executionMode = "CONFIG";

    @TableField("enabled")
    private boolean enabled = true;

    @TableField("requires_confirmation")
    private boolean requiresConfirmation = false;

    @TableField("visibility")
    private SkillVisibility visibility = SkillVisibility.PRIVATE;

    /** 展示用 emoji（与 User.avatar 一致为短字符串）；可选 */
    @TableField("avatar")
    private String avatar;

    /** 创建者用户 ID；平台种子/Built-in 对应行使用字面量 {@code public} */
    @TableField("created_by")
    private String createdBy;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    public Skill() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getConfiguration() {
        return configuration;
    }

    public void setConfiguration(String configuration) {
        this.configuration = configuration;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getExecutionMode() {
        return (executionMode == null || StringUtils.isBlank(executionMode)) ? "CONFIG" : executionMode;
    }

    public void setExecutionMode(String executionMode) {
        this.executionMode = executionMode;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isRequiresConfirmation() {
        return requiresConfirmation;
    }

    public void setRequiresConfirmation(boolean requiresConfirmation) {
        this.requiresConfirmation = requiresConfirmation;
    }

    public SkillVisibility getVisibility() {
        return visibility != null ? visibility : SkillVisibility.PUBLIC;
    }

    public void setVisibility(SkillVisibility visibility) {
        this.visibility = visibility;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    @TableField(exist = false)
    private transient java.util.List<String> templatePlaceholders;

    public java.util.List<String> getTemplatePlaceholders() {
        if (templatePlaceholders == null && configuration != null && !configuration.isEmpty()) {
            templatePlaceholders = extractPlaceholders(configuration);
        }
        return templatePlaceholders != null ? templatePlaceholders : java.util.Collections.emptyList();
    }

    public void setTemplatePlaceholders(java.util.List<String> placeholders) {
        this.templatePlaceholders = placeholders;
    }

    private static java.util.List<String> extractPlaceholders(String config) {
        java.util.List<String> result = new java.util.ArrayList<>();
        try {
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            java.util.Map<String, Object> cfg = om.readValue(config, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
            String kind = (String) cfg.get("kind");
            if (!"template".equals(kind)) return result;
            String prompt = (String) cfg.get("prompt");
            if (prompt == null) return result;
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("\\{\\{([^{}]+)\\}\\}");
            java.util.regex.Matcher m = p.matcher(prompt);
            while (m.find()) result.add(m.group(1));
        } catch (Exception ignored) {}
        return result;
    }

    // === schema_properties (persisted JSON) ===

    /**
     * DB column: stores the JSON serialization of computed schema properties.
     * Written on create/update by SkillService; read from DB by MyBatis.
     */
    @TableField("schema_properties")
    private String schemaPropertiesJson;

    public String getSchemaPropertiesJson() {
        return schemaPropertiesJson;
    }

    public void setSchemaPropertiesJson(String schemaPropertiesJson) {
        this.schemaPropertiesJson = schemaPropertiesJson;
    }

    /**
     * Transient Map getter for API serialization.
     * Priority: deserialize from `schemaPropertiesJson` (DB), fallback to compute from `configuration`.
     */
    @TableField(exist = false)
    private transient java.util.Map<String, java.util.Map<String, Object>> schemaProperties;

    @SuppressWarnings("unchecked")
    public java.util.Map<String, java.util.Map<String, Object>> getSchemaProperties() {
        if (schemaProperties != null) {
            return schemaProperties;
        }
        // 1) Try persisted JSON first
        if (schemaPropertiesJson != null && !schemaPropertiesJson.isEmpty()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                schemaProperties = om.readValue(schemaPropertiesJson,
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.LinkedHashMap<String, java.util.Map<String, Object>>>() {});
                return schemaProperties;
            } catch (Exception e) {
                // fall through to compute
            }
        }
        // 2) Fallback: compute from configuration (backward compatibility)
        if (configuration != null && !configuration.isEmpty()) {
            schemaProperties = computeSchemaProperties(configuration);
        }
        return schemaProperties != null ? schemaProperties : java.util.Collections.emptyMap();
    }

    public void setSchemaProperties(java.util.Map<String, java.util.Map<String, Object>> props) {
        this.schemaProperties = props;
    }

    private static java.util.Map<String, java.util.Map<String, Object>> computeSchemaProperties(String config) {
        return computeSchemaPropertiesInternal(config);
    }

    /**
     * Public helper: compute schema properties Map from configuration JSON string.
     * Used by SkillService to persist schema_properties on create/update.
     */
    public static java.util.Map<String, java.util.Map<String, Object>> computeSchemaPropertiesInternal(String config) {
        java.util.LinkedHashMap<String, java.util.Map<String, Object>> result = new java.util.LinkedHashMap<>();
        try {
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            java.util.Map<String, Object> cfg = om.readValue(config, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
            String kind = (String) cfg.get("kind");

            // 1) API: from parameterContract.properties + required
            java.util.Map<String, Object> pc = (java.util.Map<String, Object>) cfg.get("parameterContract");
            if (pc != null) {
                java.util.Map<String, Object> props = (java.util.Map<String, Object>) pc.get("properties");
                java.util.List<String> requiredList = (java.util.List<String>) pc.get("required");
                java.util.Set<String> requiredSet = requiredList != null
                        ? new java.util.HashSet<>(requiredList)
                        : java.util.Collections.emptySet();
                if (props != null) {
                    for (java.util.Map.Entry<String, Object> entry : props.entrySet()) {
                        if (entry.getValue() instanceof java.util.Map) {
                            java.util.Map<String, Object> propMeta = new java.util.LinkedHashMap<>((java.util.Map<String, Object>) entry.getValue());
                            if (requiredSet.contains(entry.getKey())) {
                                propMeta.put("required", true);
                            }
                            result.put(entry.getKey(), propMeta);
                        }
                    }
                }
            }

            // 2) Template: from prompt placeholders
            if ("template".equals(kind)) {
                String prompt = (String) cfg.get("prompt");
                if (prompt != null) {
                    java.util.regex.Pattern p = java.util.regex.Pattern.compile("\\{\\{([^{}]+)\\}\\}");
                    java.util.regex.Matcher m = p.matcher(prompt);
                    while (m.find()) {
                        String key = m.group(1);
                        if (!result.containsKey(key)) {
                            java.util.Map<String, Object> meta = new java.util.LinkedHashMap<>();
                            meta.put("type", "string");
                            meta.put("description", "Template placeholder: {{" + key + "}}");
                            result.put(key, meta);
                        }
                    }
                }
            }

            // 3) SSH: if has lookup, expose id
            if ("ssh".equals(kind) && cfg.get("lookup") != null) {
                if (!result.containsKey("id")) {
                    java.util.Map<String, Object> meta = new java.util.LinkedHashMap<>();
                    meta.put("type", "number");
                    meta.put("description", "服务器台账 ID（来自 server_lookup 结果，精确匹配）");
                    result.put("id", meta);
                }
            }
        } catch (Exception ignored) {}
        return result;
    }
}
