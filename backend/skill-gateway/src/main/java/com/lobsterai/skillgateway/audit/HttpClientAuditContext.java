package com.lobsterai.skillgateway.audit;

/**
 * Per-thread audit mode for {@link org.springframework.web.client.RestTemplate} calls.
 */
public final class HttpClientAuditContext {

    private static final ThreadLocal<HttpClientAuditMode> MODE = new ThreadLocal<>();

    private HttpClientAuditContext() {
    }

    public static void set(HttpClientAuditMode mode) {
        MODE.set(mode != null ? mode : HttpClientAuditMode.NONE);
    }

    public static HttpClientAuditMode getMode() {
        HttpClientAuditMode m = MODE.get();
        return m != null ? m : HttpClientAuditMode.NONE;
    }

    public static void clear() {
        MODE.remove();
    }
}
