package com.lobsterai.skillgateway.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Redacts sensitive keys from JSON for audit storage (proxy request, SSH body).
 */
public final class JsonAuditSanitizer {

    private static final Set<String> SENSITIVE_KEYS = new HashSet<>(Arrays.asList(
            "privatekey", "private_key", "password", "privkey", "authorization"
    ));

    private JsonAuditSanitizer() {
    }

    /**
     * Returns compact JSON string, or null if input is null/empty; on parse failure returns UTF-8 string with binary truncated by caller.
     */
    public static String sanitizeJsonUtf8(byte[] raw, int maxChars, ObjectMapper objectMapper) {
        if (raw == null || raw.length == 0) {
            return null;
        }
        String s = new String(raw, java.nio.charset.StandardCharsets.UTF_8);
        if (s.length() > maxChars) {
            s = s.substring(0, maxChars) + "…[truncated]";
        }
        try {
            JsonNode n = objectMapper.readTree(s);
            redactRecursive(n);
            return objectMapper.writeValueAsString(n);
        } catch (Exception e) {
            return s;
        }
    }

    private static void redactRecursive(JsonNode node) {
        if (node == null) {
            return;
        }
        if (node.isObject()) {
            ObjectNode obj = (ObjectNode) node;
            java.util.Iterator<java.util.Map.Entry<String, JsonNode>> it = obj.fields();
            while (it.hasNext()) {
                java.util.Map.Entry<String, JsonNode> e = it.next();
                String k = e.getKey();
                if (k != null && SENSITIVE_KEYS.contains(k.toLowerCase(java.util.Locale.ROOT))) {
                    obj.set(k, TextNode.valueOf("[REDACTED]"));
                } else {
                    redactRecursive(e.getValue());
                }
            }
        } else if (node.isArray()) {
            ArrayNode arr = (ArrayNode) node;
            for (int i = 0; i < arr.size(); i++) {
                redactRecursive(arr.get(i));
            }
        }
    }
}
