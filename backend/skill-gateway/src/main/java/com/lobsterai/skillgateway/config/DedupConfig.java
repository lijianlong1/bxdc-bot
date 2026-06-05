package com.lobsterai.skillgateway.config;

/**
 * 去重窗口常量（写死在代码里，**不加任何新配置**——用户硬约束）。
 *
 * - PER_SESSION_WINDOW_SECONDS：同 (userId, sessionId, requestSignature) 的去重窗口（1 小时）
 * - NO_SESSION_WINDOW_SECONDS：没有 sessionId 时的 fallback 窗口（60 秒）
 *
 * 任意状态都触发去重（不只进行中），含 COMPLETED / FAILED / TIMEOUT。
 */
public final class DedupConfig {

    private DedupConfig() {}

    /** Per-session 去重窗口（秒）。同 session + 同签名 + 1 小时内 → 视为重复。 */
    public static final int PER_SESSION_WINDOW_SECONDS = 3600;

    /** 没有 sessionId 时的 fallback 窗口（秒）。60 秒。 */
    public static final int NO_SESSION_WINDOW_SECONDS = 60;
}
