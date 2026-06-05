package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.dto.LlmSettingsResponse;
import com.lobsterai.skillgateway.dto.LlmSettingsUpdateRequest;
import com.lobsterai.skillgateway.exception.RegistrationNotAllowedException;
import com.lobsterai.skillgateway.entity.User;
import com.lobsterai.skillgateway.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.lobsterai.skillgateway.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserMapper userMapper;
    private final ApiProxyService apiProxyService;

    @Value("${agent.core.url:http://localhost:3000}")
    private String agentCoreUrl;

    /** System admin password required for public registration; default matches product spec. */
    @Value("${app.registration.admin-password:Bxdc1357}")
    private String registrationAdminPassword;

    public UserService(UserMapper userMapper, ApiProxyService apiProxyService) {
        this.userMapper = userMapper;
        this.apiProxyService = apiProxyService;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String envOrNull(String name) {
        String v = System.getenv(name);
        return trimOrNull(v);
    }

    /**
     * Merge user-stored fields with process env (same rules as agent-core). User non-empty wins per field.
     */
    public Map<String, String> mergeLlmConfigForAgent(User user) {
        Map<String, String> m = new LinkedHashMap<>();
        String envBase = envOrNull("OPENAI_API_BASE");
        String envModel = envOrNull("OPENAI_MODEL_NAME");
        // 注意：fallback 仅在 env 完全没设时才使用，避免硬编码 gpt-4 覆盖 agent-core .env
        if (envModel == null) envModel = "gpt-4";
        String envKey = envOrNull("OPENAI_API_KEY");

        String uBase = user != null ? trimOrNull(user.getLlmApiBase()) : null;
        String uModel = user != null ? trimOrNull(user.getLlmModelName()) : null;
        String uKey = user != null ? trimOrNull(user.getLlmApiKey()) : null;

        m.put("llmApiBase", uBase != null ? uBase : envBase);
        m.put("llmModelName", uModel != null ? uModel : envModel);
        m.put("llmApiKey", uKey != null ? uKey : envKey);
        return m;
    }

    public boolean hasEffectiveLlmApiKey(User user) {
        String k = mergeLlmConfigForAgent(user).get("llmApiKey");
        return k != null && !StringUtils.isBlank(k);
    }

    public LlmSettingsResponse getLlmSettingsForApi(String userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            return null;
        }
        boolean hasStoredKey = trimOrNull(user.getLlmApiKey()) != null;
        boolean effective = hasEffectiveLlmApiKey(user);
        return new LlmSettingsResponse(
                trimOrNull(user.getLlmApiBase()),
                trimOrNull(user.getLlmModelName()),
                hasStoredKey,
                effective
        );
    }

    public User updateLlmSettings(String userId, LlmSettingsUpdateRequest req) {
        User user = userMapper.selectById(userId);
        if (user == null) throw new IllegalArgumentException("User not found");
        if (req.apiBase != null) {
            user.setLlmApiBase(trimOrNull(req.apiBase));
        }
        if (req.modelName != null) {
            user.setLlmModelName(trimOrNull(req.modelName));
        }
        if (req.apiKey != null) {
            if (req.apiKey.isEmpty()) {
                user.setLlmApiKey(null);
            } else {
                user.setLlmApiKey(trimOrNull(req.apiKey));
            }
        }
        userMapper.updateById(user);
        return user;
    }

    /**
     * Map of optional overrides to send to agent-core (only non-null entries from DB).
     */
    public Map<String, String> userLlmOverridesFromDb(User user) {
        Map<String, String> o = new LinkedHashMap<>();
        if (user == null) return o;
        if (trimOrNull(user.getLlmApiBase()) != null) o.put("llmApiBase", user.getLlmApiBase().trim());
        if (trimOrNull(user.getLlmModelName()) != null) o.put("llmModelName", user.getLlmModelName().trim());
        if (trimOrNull(user.getLlmApiKey()) != null) o.put("llmApiKey", user.getLlmApiKey().trim());
        return o;
    }

    public Object proxyAvatarGenerate(Map<String, Object> payload) {
        return apiProxyService.callApi(
                agentCoreUrl + "/features/avatar/generate",
                "POST",
                Collections.singletonMap("Content-Type", "application/json"),
                payload
        );
    }

    public Object proxyTextOptimize(String userId, Map<String, Object> payload) {
        long t0 = System.currentTimeMillis();
        User u = userId != null ? getUser(userId) : null;
        Map<String, String> dbOverrides = userLlmOverridesFromDb(u);
        Map<String, Object> body = new LinkedHashMap<>(payload);
        dbOverrides.forEach(body::putIfAbsent);
        String url = agentCoreUrl + "/features/optimize-text";
        log.info("[optimize-text] forwarding to agent-core url={} hasLlmKey={} fieldId={}",
                url, dbOverrides.get("llmApiKey") != null, body.get("fieldId"));
        Object result = apiProxyService.callApi(
                url,
                "POST",
                Collections.singletonMap("Content-Type", "application/json"),
                body
        );
        log.info("[optimize-text] agent-core responded in {}ms", System.currentTimeMillis() - t0);
        return result;
    }

    private void validateRegistrationGate(String systemAdminPassword) {
        if (!constantTimeEqualsAdminPassword(systemAdminPassword)) {
            throw new RegistrationNotAllowedException();
        }
    }

    private boolean constantTimeEqualsAdminPassword(String provided) {
        String expected = registrationAdminPassword != null ? registrationAdminPassword.trim() : "";
        String p = trimOrNull(provided);
        if (p == null) {
            return false;
        }
        byte[] a = p.getBytes(StandardCharsets.UTF_8);
        byte[] b = expected.getBytes(StandardCharsets.UTF_8);
        if (a.length != b.length) {
            return false;
        }
        return MessageDigest.isEqual(a, b);
    }

    public User register(String id, String nickname, String systemAdminPassword) {
        validateRegistrationGate(systemAdminPassword);
        if (id == null || !id.matches("\\d{6}")) {
            throw new IllegalArgumentException("User ID must be exactly 6 digits.");
        }
        if (nickname == null || nickname.length() > 10) {
            throw new IllegalArgumentException("Nickname must be no longer than 10 characters.");
        }
        if (userMapper.selectById(id) != null) {
            throw new IllegalArgumentException("User ID already exists.");
        }

        // Default avatar (Generation happens asynchronously in frontend)
        String avatar = "👤";

        User user = new User();
        user.setId(id);
        user.setNickname(nickname);
        user.setAvatar(avatar);
        user.setCreatedAt(LocalDateTime.now());
        
        userMapper.insert(user);

        // Inject initial memory (Call Agent Core)
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("userId", id);
            // Injected as explicit memory.
            // Using "我的昵称是..." allows the agent to recall it naturally.
            body.put("text", "我的昵称是" + nickname);
            body.put("role", "user"); // Attribute to user so it feels like user said it
            
            apiProxyService.callApi(
                    agentCoreUrl + "/memory/add",
                    "POST",
                    Collections.singletonMap("Content-Type", "application/json"),
                    body
            );
        } catch (Exception e) {
            System.err.println("[UserService] Failed to inject initial memory: " + e.getMessage());
        }

        return user;
    }

    /**
     * Same rules as {@link #register}: nickname non-null, max 10 chars (empty allowed).
     */
    public void validateNickname(String nickname) {
        if (nickname == null) {
            throw new IllegalArgumentException("Nickname must not be null.");
        }
        if (nickname.length() > 10) {
            throw new IllegalArgumentException("Nickname must be no longer than 10 characters.");
        }
    }

    /** Avatar stored as short emoji / text; keep bounded. */
    public void validateAvatar(String avatar) {
        if (avatar == null) {
            throw new IllegalArgumentException("Avatar is required.");
        }
        String t = avatar.trim();
        if (t.isEmpty()) {
            throw new IllegalArgumentException("Avatar cannot be empty.");
        }
        if (t.length() > 32) {
            throw new IllegalArgumentException("Avatar is too long.");
        }
    }

    /**
     * Updates nickname and/or avatar. At least one field must be non-null.
     */
    public User updateProfile(String id, String nickname, String avatar) {
        boolean hasNickname = nickname != null;
        boolean hasAvatar = avatar != null;
        if (!hasNickname && !hasAvatar) {
            throw new IllegalArgumentException("At least one of nickname or avatar is required.");
        }
        User user = userMapper.selectById(id); if (user == null) throw new IllegalArgumentException("User not found");
        if (hasNickname) {
            validateNickname(nickname);
            user.setNickname(nickname);
        }
        if (hasAvatar) {
            validateAvatar(avatar);
            user.setAvatar(avatar.trim());
        }
        userMapper.updateById(user);
        return user;
    }

    public User updateAvatar(String id, String avatar) {
        validateAvatar(avatar);
        User user = userMapper.selectById(id); if (user == null) throw new IllegalArgumentException("User not found");
        user.setAvatar(avatar.trim());
        userMapper.updateById(user);
        return user;
    }

    public User login(String id) {
        if (id == null) return null;
        return userMapper.selectById(id);
    }

    public User getUser(String id) {
        if (id == null) return null;
        return userMapper.selectById(id);
    }
}
