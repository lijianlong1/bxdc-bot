package com.lobsterai.skillgateway.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 请求签名工具。
 *
 * 用途：把一次"对外 API 请求"的所有可观测属性 hash 成 64 位 hex 字符串，
 * 用于去重——同 (user, sessionId, signature) 在窗口内只允许创建一次异步任务。
 *
 * 算法：SHA-256(method | url | canonicalJson(body) | idJsonPath | pollMethod | pollEndpoint)
 *
 * `canonicalJson(body)` 递归排序 JSON key，保证 LLM 传参顺序差异不影响签名。
 *
 * 不签名 headers（带 token 的请求如果按 headers 去重会导致冲突）。
 */
public final class RequestSignatureUtil {

    private RequestSignatureUtil() {}

    /**
     * 计算请求签名（SHA-256 hex，64 位）。
     */
    public static String compute(
            String method,
            String url,
            Object body,
            String idJsonPath,
            String pollMethod,
            String pollEndpoint
    ) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(safeString(method).toUpperCase().getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '|');
            digest.update(safeString(url).getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '|');
            digest.update(canonicalizeJson(body).getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '|');
            digest.update(safeString(idJsonPath).getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '|');
            digest.update(safeString(pollMethod).getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '|');
            digest.update(safeString(pollEndpoint).getBytes(StandardCharsets.UTF_8));

            byte[] hash = digest.digest();
            return toHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /**
     * 递归把任意 JSON-like 对象规范化成 key 排序后的字符串。
     * 顺序：null / 基本类型 → 原样；Map → TreeMap（key 排序）→ 递归；List → 递归。
     *
     * 行为：
     * - null → "null"
     * - String：若首尾是 {/[ 则尝试按 JSON 解析（避免 LLM 一次传 Map 一次传 String 导致签名漂移）；
     *   解析失败或不是 JSON 形态则原样返回。
     * - Map / List：递归
     * - 其他：toString
     */
    @SuppressWarnings("unchecked")
    public static String canonicalizeJson(Object value) {
        if (value == null) return "null";
        if (value instanceof String) {
            String s = (String) value;
            char first = s.isEmpty() ? '\0' : s.charAt(0);
            char last = s.length() <= 1 ? '\0' : s.charAt(s.length() - 1);
            if ((first == '{' && last == '}') || (first == '[' && last == ']')) {
                try {
                    Object parsed = new com.fasterxml.jackson.databind.ObjectMapper().readValue(s, Object.class);
                    return canonicalizeJson(parsed);
                } catch (Exception ignore) {
                    // 解析失败则按 raw 字符串处理
                }
            }
            return s;
        }
        if (value instanceof Map) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            for (Map.Entry<String, Object> e : ((Map<String, Object>) value).entrySet()) {
                if (e.getKey() == null) continue;
                sorted.put(e.getKey(), e.getValue());
            }
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : sorted.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(escapeJsonString(e.getKey()));
                sb.append(':');
                sb.append(canonicalizeJson(e.getValue()));
            }
            sb.append('}');
            return sb.toString();
        }
        if (value instanceof List) {
            List<Object> list = (List<Object>) value;
            // 列表保持原顺序（不能排序，否则语义可能改变）
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(canonicalizeJson(list.get(i)));
            }
            sb.append(']');
            return sb.toString();
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        return value.toString();
    }

    private static String safeString(String s) {
        return s == null ? "" : s;
    }

    private static String escapeJsonString(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }

    private static final char[] HEX_CHARS = "0123456789abcdef".toCharArray();

    private static String toHex(byte[] bytes) {
        char[] chars = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xff;
            chars[i * 2] = HEX_CHARS[v >>> 4];
            chars[i * 2 + 1] = HEX_CHARS[v & 0x0f];
        }
        return new String(chars);
    }
}
