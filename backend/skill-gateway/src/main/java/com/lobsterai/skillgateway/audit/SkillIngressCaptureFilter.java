package com.lobsterai.skillgateway.audit;

import com.lobsterai.skillgateway.util.StringUtils;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.util.UUID;

/**
 * Captures raw inbound bodies for Skill execution routes so outbound audit can correlate
 * with agent-core submissions. Sets {@code X-Correlation-Id} on the response (echo or generated).
 * <p>
 * Optional: agent-core may send {@code X-Correlation-Id}; otherwise the gateway generates one
 * and returns it on the response for client-side logging.
 * </p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class SkillIngressCaptureFilter extends OncePerRequestFilter {

    public static final String HEADER_CORRELATION_ID = "X-Correlation-Id";
    /** Inbound: extension {@code skills} row id (agent-core) for audit correlation. */
    public static final String HEADER_SKILL_ID = "X-Skill-Id";
    public static final String MDC_CORRELATION_ID = "correlationId";
    public static final String MDC_USER_ID = "skillGatewayUserId";
    public static final String MDC_SKILL_ID = "skillGatewaySkillId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!shouldWrap(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        ContentCachingRequestWrapper wrapped = new ContentCachingRequestWrapper(request);
        String cid = request.getHeader(HEADER_CORRELATION_ID);
        if (cid == null || StringUtils.isBlank(cid)) {
            cid = UUID.randomUUID().toString();
        }
        response.setHeader(HEADER_CORRELATION_ID, cid);
        String userHeader = request.getHeader("X-User-Id");
        String skillHeader = request.getHeader(HEADER_SKILL_ID);
        MDC.put(MDC_CORRELATION_ID, cid);
        if (userHeader != null && !StringUtils.isBlank(userHeader)) {
            MDC.put(MDC_USER_ID, userHeader.trim());
        }
        if (skillHeader != null && !StringUtils.isBlank(skillHeader)) {
            MDC.put(MDC_SKILL_ID, skillHeader.trim());
        }
        try {
            filterChain.doFilter(wrapped, response);
        } finally {
            MDC.remove(MDC_CORRELATION_ID);
            MDC.remove(MDC_USER_ID);
            MDC.remove(MDC_SKILL_ID);
        }
    }

    private static boolean shouldWrap(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI();
        if (path == null) {
            return false;
        }
        return path.endsWith("/api/skills/ssh")
                || path.endsWith("/api/skills/api")
                || path.endsWith("/api/skills/linux-script")
                || path.endsWith("/api/skills/compute")
                || path.endsWith("/api/system-skills/execute");
    }
}
