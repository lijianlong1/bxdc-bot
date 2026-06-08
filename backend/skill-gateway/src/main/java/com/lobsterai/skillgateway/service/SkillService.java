package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.entity.Skill;
import com.lobsterai.skillgateway.entity.SkillVisibility;
import com.lobsterai.skillgateway.mapper.SkillMapper;
import com.lobsterai.skillgateway.util.StringUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class SkillService {

    /** 平台公共种子 / Built-in 对应行的创建者标识（与 spec 一致） */
    public static final String PLATFORM_PUBLIC_AUTHOR = "public";

    /** 可写 {@code createdBy=public} 平台行的固定管理员用户 ID（与 X-User-Id 字符串比较，非配置项） */
    public static final String SKILL_PLATFORM_ADMIN_USER_ID = "890728";

    private final SkillMapper skillMapper;
    private final ObjectMapper objectMapper;

    public SkillService(SkillMapper skillMapper, ObjectMapper objectMapper) {
        this.skillMapper = skillMapper;
        this.objectMapper = objectMapper;
    }

    public List<Skill> listSkillsForUser(String userId) {
        if (userId == null || StringUtils.isBlank(userId)) {
            return skillMapper.findAllPublicSummary();
        }
        return skillMapper.findVisibleSummaryForUser(userId);
    }

    public Optional<Skill> getSkillByIdForUser(Long id, String userId) {
        Skill skill = skillMapper.selectById(id);
        if (skill == null || !canViewSkill(skill, userId)) {
            return Optional.empty();
        }
        return Optional.of(skill);
    }

    public Optional<Skill> getSkillByName(String name) {
        return skillMapper.findByName(name);
    }

    public Skill createSkill(Skill skill, String userId) {
        if (userId == null || StringUtils.isBlank(userId)) {
            throw new IllegalArgumentException("X-User-Id is required");
        }
        if (skillMapper.findByName(skill.getName()).isPresent()) {
            throw new IllegalArgumentException("Skill with name " + skill.getName() + " already exists");
        }
        skill.setCreatedBy(userId);
        if (skill.getVisibility() == null) {
            skill.setVisibility(SkillVisibility.PRIVATE);
        }
        validateSkillAvatar(skill.getAvatar());
        skill.setExecutionMode(normalizeExecutionMode(skill.getExecutionMode()));
        skill.setConfiguration(normalizeAndValidateConfiguration(skill.getExecutionMode(), skill.getConfiguration()));
        persistSchemaProperties(skill);
        skillMapper.insert(skill);
        return skill;
    }

    public Skill updateSkill(Long id, Skill skillDetails, String userId) {
        Skill skill = skillMapper.selectById(id);
        if (skill == null) {
            throw new IllegalArgumentException("Skill not found for this id :: " + id);
        }
        if (!canWriteSkill(skill, userId)) {
            throw new IllegalArgumentException("Skill not found for this id :: " + id);
        }

        skill.setName(skillDetails.getName());
        skill.setDescription(skillDetails.getDescription());
        skill.setType(skillDetails.getType());
        skill.setExecutionMode(normalizeExecutionMode(skillDetails.getExecutionMode()));
        skill.setConfiguration(normalizeAndValidateConfiguration(skill.getExecutionMode(), skillDetails.getConfiguration()));
        persistSchemaProperties(skill);
        skill.setEnabled(skillDetails.isEnabled());
        skill.setRequiresConfirmation(skillDetails.isRequiresConfirmation());
        if (skillDetails.getVisibility() != null) {
            skill.setVisibility(skillDetails.getVisibility());
        }
        // Only touch avatar when the client sends a value. Omitted / null must preserve the stored emoji
        // (e.g. toggle enabled sends a partial body; JSON.stringify drops undefined → Jackson null).
        if (skillDetails.getAvatar() != null) {
            validateSkillAvatar(skillDetails.getAvatar());
            String trimmed = skillDetails.getAvatar().trim();
            skill.setAvatar(trimmed.isEmpty() ? null : trimmed);
        }

        skillMapper.updateById(skill);
        return skill;
    }

    public void deleteSkill(Long id, String userId) {
        Skill skill = skillMapper.selectById(id);
        if (skill == null) {
            throw new IllegalArgumentException("Skill not found for this id :: " + id);
        }
        if (!canWriteSkill(skill, userId)) {
            throw new IllegalArgumentException("Skill not found for this id :: " + id);
        }
        skillMapper.deleteById(id);
    }

    /**
     * Compute schema properties from the skill's configuration JSON
     * and persist them to the schema_properties DB column.
     */
    private void persistSchemaProperties(Skill skill) {
        try {
            String config = skill.getConfiguration();
            if (config == null || config.isEmpty()) {
                skill.setSchemaPropertiesJson(null);
                return;
            }
            java.util.Map<String, java.util.Map<String, Object>> props =
                Skill.computeSchemaPropertiesInternal(config);
            if (props.isEmpty()) {
                skill.setSchemaPropertiesJson(null);
                return;
            }
            skill.setSchemaPropertiesJson(objectMapper.writeValueAsString(props));
        } catch (Exception e) {
            skill.setSchemaPropertiesJson(null);
        }
    }

    /** Optional emoji; when set, same length bound as user avatar. */
    private static void validateSkillAvatar(String avatar) {
        if (avatar == null || StringUtils.isBlank(avatar)) {
            return;
        }
        String t = avatar.trim();
        if (t.length() > 32) {
            throw new IllegalArgumentException("Skill avatar is too long.");
        }
    }

    private static boolean canViewSkill(Skill skill, String userId) {
        if (skill.getVisibility() == SkillVisibility.PUBLIC) {
            return true;
        }
        if (userId == null || StringUtils.isBlank(userId)) {
            return false;
        }
        return userId.equals(skill.getCreatedBy());
    }

    private static boolean canWriteSkill(Skill skill, String userId) {
        if (userId == null || StringUtils.isBlank(userId)) {
            return false;
        }
        if (skill.getVisibility() == SkillVisibility.PRIVATE) {
            return userId.equals(skill.getCreatedBy());
        }
        // PUBLIC: only creator, except platform rows (createdBy=public) editable by fixed admin id only
        if (PLATFORM_PUBLIC_AUTHOR.equals(skill.getCreatedBy())) {
            return SKILL_PLATFORM_ADMIN_USER_ID.equals(userId);
        }
        return userId.equals(skill.getCreatedBy());
    }

    private static String normalizeExecutionMode(String executionMode) {
        if (executionMode == null || StringUtils.isBlank(executionMode)) {
            return "CONFIG";
        }

        String normalized = executionMode.trim().toUpperCase();
        if ("CONFIG".equals(normalized) || "OPENCLAW".equals(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("Unsupported executionMode: " + executionMode);
    }

    private String normalizeAndValidateConfiguration(String executionMode, String configuration) {
        if (configuration == null || StringUtils.isBlank(configuration)) {
            throw new IllegalArgumentException("configuration is required");
        }

        final JsonNode root;
        try {
            root = objectMapper.readTree(configuration);
        } catch (Exception e) {
            throw new IllegalArgumentException("configuration must be valid JSON");
        }

        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("configuration must be a JSON object");
        }

        if ("OPENCLAW".equals(executionMode)) {
            validateOpenClawConfiguration(root);
            return root.toString();
        }

        ObjectNode normalized = normalizeConfigConfiguration((ObjectNode) root);
        validateConfigConfiguration(normalized);
        return normalized.toString();
    }

    private ObjectNode normalizeConfigConfiguration(ObjectNode root) {
        String kind = requiredText(root, "kind");
        ObjectNode normalized = root.deepCopy();
        String preset = readOptionalPreset(normalized);

        switch (kind) {
            case "time":
                normalized.put("kind", "api");
                normalized.put("preset", "current-time");
                return normalized;
            case "monitor":
                normalized.put("kind", "ssh");
                normalized.put("preset", "server-resource-status");
                return normalized;
            case "api":
            case "ssh":
                normalized.put("kind", kind);
                if (preset != null && !StringUtils.isBlank(preset)) {
                    normalized.put("preset", preset);
                }
                normalized.remove("profile");
                return normalized;
            case "template":
                normalized.put("kind", "template");
                return normalized;
            default:
                throw new IllegalArgumentException("Unsupported CONFIG kind: " + kind);
        }
    }

    private static String readOptionalPreset(ObjectNode root) {
        JsonNode preset = root.get("preset");
        if (preset != null && !preset.isNull()) {
            if (!preset.isTextual()) {
                throw new IllegalArgumentException("preset must be a string when provided");
            }
            return preset.asText();
        }

        JsonNode profile = root.get("profile");
        if (profile != null && !profile.isNull()) {
            if (!profile.isTextual()) {
                throw new IllegalArgumentException("profile must be a string when provided");
            }
            return profile.asText();
        }
        return null;
    }

    private static void validateConfigConfiguration(JsonNode root) {
        String kind = requiredText(root, "kind");
        if ("openclaw".equals(kind)) {
            throw new IllegalArgumentException("CONFIG executionMode cannot use openclaw configuration");
        }

        switch (kind) {
            case "api":
                requiredText(root, "operation");
                requiredText(root, "method");
                requiredText(root, "endpoint");
                optionalText(root, "preset");
                optionalText(root, "responseTimestampField");
                optionalText(root, "interfaceDescription");
                break;
            case "ssh":
                requiredText(root, "operation");
                requiredText(root, "lookup");
                requiredText(root, "executor");
                requiredText(root, "command");
                optionalText(root, "preset");
                optionalBoolean(root, "readOnly");
                break;
            case "template":
                requiredText(root, "prompt");
                break;
            case "time":
            case "monitor":
                throw new IllegalArgumentException(
                        "Legacy CONFIG kind is no longer accepted directly. Use canonical kind api/ssh."
                );
            default:
                throw new IllegalArgumentException("Unsupported CONFIG kind: " + kind);
        }
    }

    private static void validateOpenClawConfiguration(JsonNode root) {
        String kind = requiredText(root, "kind");
        if (!"openclaw".equals(kind)) {
            throw new IllegalArgumentException("OPENCLAW executionMode requires kind=openclaw");
        }

        requiredText(root, "systemPrompt");

        JsonNode allowedTools = root.get("allowedTools");
        if (allowedTools != null && !allowedTools.isNull()) {
            if (!allowedTools.isArray()) {
                throw new IllegalArgumentException("allowedTools must be an array when provided");
            }
            for (JsonNode tool : allowedTools) {
                if (!tool.isTextual() || StringUtils.isBlank(tool.asText())) {
                    throw new IllegalArgumentException("allowedTools entries must be non-empty strings");
                }
            }
        }

        JsonNode orchestration = root.get("orchestration");
        if (orchestration == null || !orchestration.isObject()) {
            throw new IllegalArgumentException("OPENCLAW configuration requires orchestration object");
        }
        String mode = requiredText(orchestration, "mode");
        if (!"serial".equals(mode)) {
            throw new IllegalArgumentException("OPENCLAW orchestration.mode must be serial");
        }
    }

    private static String requiredText(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value == null || !value.isTextual() || StringUtils.isBlank(value.asText())) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.asText();
    }

    private static void optionalText(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value != null && !value.isNull() && !value.isTextual()) {
            throw new IllegalArgumentException(fieldName + " must be a string when provided");
        }
    }

    private static void optionalBoolean(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value != null && !value.isNull() && !value.isBoolean()) {
            throw new IllegalArgumentException(fieldName + " must be a boolean when provided");
        }
    }
}
