package com.lobsterai.skillgateway.audit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public final class AuditPayloadTruncator {

    public static final class Result {
        private final byte[] stored;
        private final boolean truncated;
        private final String sha256Hex;

        public Result(byte[] stored, boolean truncated, String sha256Hex) {
            this.stored = stored;
            this.truncated = truncated;
            this.sha256Hex = sha256Hex;
        }

        public byte[] stored() { return stored; }
        public boolean truncated() { return truncated; }
        public String sha256Hex() { return sha256Hex; }
    }

    private AuditPayloadTruncator() {
    }

    public static Result truncate(byte[] full, int maxBytes) {
        if (full == null) {
            return new Result(null, false, null);
        }
        String sha = sha256Hex(full);
        if (full.length <= maxBytes) {
            return new Result(full, false, sha);
        }
        byte[] prefix = new byte[maxBytes];
        System.arraycopy(full, 0, prefix, 0, maxBytes);
        return new Result(prefix, true, sha);
    }

    public static Result truncateUtf8(String full, int maxBytes) {
        if (full == null) {
            return new Result(null, false, null);
        }
        return truncate(full.getBytes(StandardCharsets.UTF_8), maxBytes);
    }

    private static final char[] HEX_CHARS = "0123456789abcdef".toCharArray();

    public static String sha256Hex(byte[] data) {
        if (data == null) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            char[] hex = new char[digest.length * 2];
            for (int i = 0; i < digest.length; i++) {
                int v = digest[i] & 0xFF;
                hex[i * 2] = HEX_CHARS[v >>> 4];
                hex[i * 2 + 1] = HEX_CHARS[v & 0x0F];
            }
            return new String(hex);
        } catch (Exception e) {
            return null;
        }
    }
}
