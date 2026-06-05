package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.dto.LlmSettingsResponse;
import com.lobsterai.skillgateway.dto.LlmSettingsUpdateRequest;
import com.lobsterai.skillgateway.entity.User;
import com.lobsterai.skillgateway.service.UserService;
import com.lobsterai.skillgateway.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "*")
public class UserController {

    private static final String HEADER_USER_ID = "X-User-Id";
    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    private static boolean isSelf(String pathUserId, String xUserId) {
        if (xUserId == null || StringUtils.isBlank(xUserId)) {
            return false;
        }
        return pathUserId.equals(xUserId.trim());
    }

    private static String stringField(Map<String, Object> body, String key) {
        if (body == null || !body.containsKey(key)) {
            return null;
        }
        Object v = body.get(key);
        if (v == null) {
            return null;
        }
        return v instanceof String ? (String) v : String.valueOf(v);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable String id) {
        User user = userService.getUser(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{id}/avatar")
    public ResponseEntity<?> updateAvatar(
            @PathVariable String id,
            @RequestHeader(value = HEADER_USER_ID, required = false) String xUserId,
            @RequestBody Map<String, String> payload) {
        if (!isSelf(id, xUserId)) {
            return ResponseEntity.status(403).body(Collections.singletonMap("error", "X-User-Id must match path user id"));
        }
        String avatar = payload != null ? payload.get("avatar") : null;
        if (avatar == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Avatar is required"));
        }
        try {
            User user = userService.updateAvatar(id, avatar);
            return ResponseEntity.ok(user);
        } catch (IllegalArgumentException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Bad request";
            if ("User not found".equals(msg)) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", msg));
        }
    }

    /**
     * Update nickname and/or avatar for the logged-in user. Requires {@code X-User-Id} to match {@code id}.
     * Request body must not contain {@code id} (immutable).
     */
    @PutMapping("/{id}/profile")
    public ResponseEntity<?> updateProfile(
            @PathVariable String id,
            @RequestHeader(value = HEADER_USER_ID, required = false) String xUserId,
            @RequestBody(required = false) Map<String, Object> body) {
        if (!isSelf(id, xUserId)) {
            return ResponseEntity.status(403).body(Collections.singletonMap("error", "X-User-Id must match path user id"));
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Body is required"));
        }
        if (body.containsKey("id")) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "id cannot be changed"));
        }
        String nickname = body.containsKey("nickname") ? stringField(body, "nickname") : null;
        String avatar = body.containsKey("avatar") ? stringField(body, "avatar") : null;
        try {
            User user = userService.updateProfile(id, nickname, avatar);
            return ResponseEntity.ok(user);
        } catch (IllegalArgumentException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Bad request";
            if ("User not found".equals(msg)) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", msg));
        }
    }

    @GetMapping("/{id}/llm-settings")
    public ResponseEntity<?> getLlmSettings(@PathVariable String id) {
        LlmSettingsResponse r = userService.getLlmSettingsForApi(id);
        if (r == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(r);
    }

    /**
     * Internal API for agent-core to fetch complete LLM config including API key.
     * This endpoint should only be accessible from localhost or trusted internal networks.
     */
    @GetMapping("/{id}/llm-config-internal")
    public ResponseEntity<?> getLlmConfigInternal(@PathVariable String id) {
        User user = userService.getUser(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        // 只返回用户显式设置过的字段，不返回 env 兜底值。
        // agent-core 拿到后用自己的 .env 兜底，避免硬编码 gpt-4 覆盖用户 .env 配置。
        Map<String, String> userOnly = new LinkedHashMap<>();
        if (user.getLlmApiBase() != null && !user.getLlmApiBase().trim().isEmpty()) {
            userOnly.put("llmApiBase", user.getLlmApiBase().trim());
        }
        if (user.getLlmModelName() != null && !user.getLlmModelName().trim().isEmpty()) {
            userOnly.put("llmModelName", user.getLlmModelName().trim());
        }
        if (user.getLlmApiKey() != null && !user.getLlmApiKey().trim().isEmpty()) {
            userOnly.put("llmApiKey", user.getLlmApiKey().trim());
        }
        return ResponseEntity.ok(userOnly);
    }

    @PutMapping("/{id}/llm-settings")
    public ResponseEntity<?> putLlmSettings(@PathVariable String id, @RequestBody LlmSettingsUpdateRequest body) {
        try {
            User user = userService.updateLlmSettings(id, body);
            LlmSettingsResponse r = userService.getLlmSettingsForApi(user.getId());
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Proxies to agent-core avatar generation with merged LLM config (user + env on gateway JVM).
     */
    @PostMapping("/{id}/avatar/generate")
    public ResponseEntity<?> generateAvatar(@PathVariable String id, @RequestBody Map<String, String> body) {
        String nickname = body.get("nickname");
        if (nickname == null || StringUtils.isBlank(nickname)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "nickname is required"));
        }
        User user = userService.getUser(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        if (!userService.hasEffectiveLlmApiKey(user)) {
            Map<String, String> errBody = new HashMap<>();
            errBody.put("error", "LLM API key not configured");
            errBody.put("avatar", "👤");
            return ResponseEntity.badRequest().body(errBody);
        }
        Map<String, String> merged = userService.mergeLlmConfigForAgent(user);
        Map<String, Object> payload = new HashMap<>();
        payload.put("nickname", nickname.trim());
        payload.put("llmApiBase", merged.get("llmApiBase"));
        payload.put("llmModelName", merged.get("llmModelName"));
        payload.put("llmApiKey", merged.get("llmApiKey"));
        try {
            Object res = userService.proxyAvatarGenerate(payload);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Collections.singletonMap("error", "Avatar service error: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/optimize-text")
    public ResponseEntity<?> optimizeText(
            @PathVariable String id,
            @RequestBody Map<String, Object> body
    ) {
        User user = userService.getUser(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        log.info("[optimize-text] userId={} fieldId={} currentTextLen={}",
                id, body.get("fieldId"),
                body.get("currentText") instanceof String ? ((String) body.get("currentText")).length() : 0);
        try {
            Object res = userService.proxyTextOptimize(id, body);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            Map<String, String> optErr = new HashMap<>();
            optErr.put("error", "AI 优化服务异常");
            optErr.put("hint", e.getMessage());
            return ResponseEntity.status(502).body(optErr);
        }
    }
}
