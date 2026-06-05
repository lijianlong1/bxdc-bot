package com.lobsterai.skillgateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lobsterai.skillgateway.audit.*;
import com.lobsterai.skillgateway.entity.GatewayOutboundAuditLog;
import com.lobsterai.skillgateway.entity.SkillSshInvocationAudit;
import com.lobsterai.skillgateway.mapper.GatewayOutboundAuditLogMapper;
import com.lobsterai.skillgateway.mapper.SkillSshInvocationAuditMapper;
import com.lobsterai.skillgateway.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.HttpStatusCodeException;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

@Service
public class GatewayOutboundAuditService {

    private static final Logger log = LoggerFactory.getLogger(GatewayOutboundAuditService.class);

    private final GatewayOutboundAuditLogMapper gatewayOutboundAuditLogMapper;
    private final SkillSshInvocationAuditMapper skillSshInvocationAuditMapper;
    private final IngressSnapshotReader ingressSnapshotReader;
    private final ObjectMapper objectMapper;
    private final int maxPayloadBytes;
    private final java.util.List<String> extraRedactedHeaders;

    public GatewayOutboundAuditService(
            GatewayOutboundAuditLogMapper gatewayOutboundAuditLogMapper,
            SkillSshInvocationAuditMapper skillSshInvocationAuditMapper,
            IngressSnapshotReader ingressSnapshotReader,
            ObjectMapper objectMapper,
            @Value("${app.gateway-audit.max-payload-bytes:1048576}") int maxPayloadBytes,
            @Value("${app.gateway-audit.redacted-headers:}") String extraRedactedHeaders
    ) {
        this.gatewayOutboundAuditLogMapper = gatewayOutboundAuditLogMapper;
        this.skillSshInvocationAuditMapper = skillSshInvocationAuditMapper;
        this.ingressSnapshotReader = ingressSnapshotReader;
        this.objectMapper = objectMapper;
        this.maxPayloadBytes = maxPayloadBytes;
        this.extraRedactedHeaders = parseCsv(extraRedactedHeaders);
    }

    private static java.util.List<String> parseCsv(String csv) {
        if (csv == null || StringUtils.isBlank(csv)) {
            return java.util.Collections.emptyList();
        }
        return java.util.Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toList());
    }

    public void recordHttpOutboundSuccess(HttpRequest request, byte[] outboundBodyBytes, ClientHttpResponse response,
                                          String skillContext) {
        try {
            GatewayOutboundAuditLog row = baseHttpRow(request, outboundBodyBytes, skillContext);
            row.setStatus("SUCCESS");
            row.setErrorMessage(null);
            fillHttpResponse(row, response);
            gatewayOutboundAuditLogMapper.insert(row);
        } catch (Exception e) {
            // Include cause: audit failures are swallowed (must not break RestTemplate), but ops need the SQL/constraint text.
            log.warn("gateway outbound audit (HTTP success) failed", e);
        }
    }

    public void recordHttpOutboundFailure(HttpRequest request, byte[] outboundBodyBytes, Exception error,
                                          String skillContext) {
        try {
            GatewayOutboundAuditLog row = baseHttpRow(request, outboundBodyBytes, skillContext);
            row.setStatus("FAILURE");
            row.setErrorMessage(error != null && error.getMessage() != null ? error.getMessage() : "unknown error");
            if (error instanceof HttpStatusCodeException) {
                HttpStatusCodeException hs = (HttpStatusCodeException) error;
                row.setOutboundResponseStatus(hs.getStatusCode().value());
                try {
                    byte[] b = hs.getResponseBodyAsByteArray();
                    AuditPayloadTruncator.Result trb = AuditPayloadTruncator.truncate(b, maxPayloadBytes);
                    row.setOutboundResponseBody(trb.stored());
                    row.setOutboundResponseTruncated(trb.truncated());
                    row.setOutboundResponseSha256(trb.sha256Hex());
                } catch (Exception ignored) {
                }
                try {
                    row.setOutboundResponseHeadersJson(
                            AuditHeaderJsonBuilder.toJson(hs.getResponseHeaders(), extraRedactedHeaders, objectMapper));
                } catch (Exception ignored) {
                }
            } else {
                try {
                    if (error.getCause() instanceof HttpStatusCodeException) {
                        HttpStatusCodeException hs = (HttpStatusCodeException) error.getCause();
                        row.setOutboundResponseStatus(hs.getStatusCode().value());
                        byte[] b = hs.getResponseBodyAsByteArray();
                        AuditPayloadTruncator.Result trb = AuditPayloadTruncator.truncate(b, maxPayloadBytes);
                        row.setOutboundResponseBody(trb.stored());
                        row.setOutboundResponseTruncated(trb.truncated());
                        row.setOutboundResponseSha256(trb.sha256Hex());
                        row.setOutboundResponseHeadersJson(
                                AuditHeaderJsonBuilder.toJson(hs.getResponseHeaders(), extraRedactedHeaders, objectMapper));
                    }
                } catch (Exception ignored) {
                }
            }
            gatewayOutboundAuditLogMapper.insert(row);
        } catch (Exception e) {
            log.warn("gateway outbound audit (HTTP failure) failed", e);
        }
    }

    /**
     * Best-effort capture of upstream HTTP response. Must not throw: any exception here would skip
     * {@code repository.save} and drop the whole outbound row (user-visible call still succeeds).
     */
    private void fillHttpResponse(GatewayOutboundAuditLog row, ClientHttpResponse response) {
        if (response == null) {
            return;
        }
        try {
            row.setOutboundResponseStatus(response.getStatusCode().value());
            HttpHeaders rh = response.getHeaders();
            row.setOutboundResponseHeadersJson(AuditHeaderJsonBuilder.toJson(rh, extraRedactedHeaders, objectMapper));
            byte[] bodyBytes = StreamUtils.copyToByteArray(response.getBody());
            AuditPayloadTruncator.Result trb = AuditPayloadTruncator.truncate(bodyBytes, maxPayloadBytes);
            row.setOutboundResponseBody(trb.stored());
            row.setOutboundResponseTruncated(trb.truncated());
            row.setOutboundResponseSha256(trb.sha256Hex());
        } catch (Exception e) {
            // Not only IOException: buffering/clients may throw IllegalStateException if the stream was touched
            // or the status line is unavailable; still persist the rest of the audit row.
            log.debug("failed to read outbound response for audit: {}", e.toString());
        }
    }

    private GatewayOutboundAuditLog baseHttpRow(HttpRequest request, byte[] outboundBodyBytes, String skillContext) {
        GatewayOutboundAuditLog row = new GatewayOutboundAuditLog();
        row.setRecordedAt(Instant.now());
        row.setOutboundKind("HTTP");
        row.setCorrelationId(correlationOrGenerated());
        row.setUserId(AuditPrincipalResolver.currentAuditUserId());
        row.setDestination(request.getURI().toString());
        row.setHttpMethod(request.getMethod().name());
        row.setSkillContext(skillContext);
        row.setSkillId(AuditPrincipalResolver.currentSkillId());

        IngressCapture ingress = ingressSnapshotReader.readCurrentRequest();
        row.setOriginIncomplete(ingress.incomplete());
        row.setOriginHeadersJson(ingress.headersJson());
        row.setOriginBody(ingress.body());
        row.setOriginTruncated(ingress.bodyTruncated());
        row.setOriginSha256(ingress.bodySha256());
        String proxy = JsonAuditSanitizer.sanitizeJsonUtf8(ingress.body(), maxPayloadBytes, objectMapper);
        row.setProxyRequestJson(proxy);

        String outboundHeadersJson = AuditHeaderJsonBuilder.toJson(request, extraRedactedHeaders, objectMapper);
        row.setOutboundHeadersJson(outboundHeadersJson);

        AuditPayloadTruncator.Result ob = AuditPayloadTruncator.truncate(outboundBodyBytes, maxPayloadBytes);
        row.setOutboundBody(ob.stored());
        row.setOutboundTruncated(ob.truncated());
        row.setOutboundSha256(ob.sha256Hex());
        return row;
    }

    /**
     * SSH 审计：写 {@code gateway_outbound_audit_logs}（与现网一致）+ {@code skill_ssh_invocation_audit_logs}。
     *
     * @param executionResult 成功时的命令输出，失败时可为 null
     * @param serverLedgerId  linux-script 路径下解析到的台账 id，否则 null
     */
    public void recordSsh(
            String userId,
            String host,
            int port,
            String command,
            boolean success,
            String errorMessage,
            String skillContext,
            String executionResult,
            Long serverLedgerId
    ) {
        try {
            String correlationId = correlationOrGenerated();
            GatewayOutboundAuditLog row = new GatewayOutboundAuditLog();
            row.setRecordedAt(Instant.now());
            row.setOutboundKind("SSH");
            row.setCorrelationId(correlationId);
            String uid = userId != null && !StringUtils.isBlank(userId) ? userId.trim() : AuditPrincipalResolver.currentAuditUserId();
            row.setUserId(uid);
            row.setDestination(host + ":" + port);
            row.setStatus(success ? "SUCCESS" : "FAILURE");
            row.setErrorMessage(success ? null : errorMessage);
            row.setSshCommand(command);
            row.setSkillContext(skillContext);
            row.setSkillId(AuditPrincipalResolver.currentSkillId());

            IngressCapture ingress = ingressSnapshotReader.readCurrentRequest();
            row.setOriginIncomplete(ingress.incomplete());
            row.setOriginHeadersJson(ingress.headersJson());
            row.setOriginBody(ingress.body());
            row.setOriginTruncated(ingress.bodyTruncated());
            row.setOriginSha256(ingress.bodySha256());

            gatewayOutboundAuditLogMapper.insert(row);
            saveSshSkillAudit(correlationId, uid, host, port, command, success, errorMessage, skillContext, executionResult, serverLedgerId);
        } catch (Exception e) {
            log.warn("gateway outbound audit (SSH) failed", e);
        }
    }

    private void saveSshSkillAudit(
            String correlationId,
            String userId,
            String host,
            int port,
            String command,
            boolean success,
            String errorMessage,
            String skillContext,
            String executionResult,
            Long serverLedgerId
    ) {
        try {
            IngressCapture ingress = ingressSnapshotReader.readCurrentRequest();
            String agentJson = JsonAuditSanitizer.sanitizeJsonUtf8(ingress.body(), maxPayloadBytes, objectMapper);
            SkillSshInvocationAudit a = new SkillSshInvocationAudit();
            a.setRecordedAt(Instant.now());
            a.setCorrelationId(correlationId);
            a.setUserId(userId);
            a.setSkillId(AuditPrincipalResolver.currentSkillId());
            a.setSkillContext(skillContext);
            a.setAgentRequestJson(agentJson);
            a.setResolvedHost(host);
            a.setResolvedPort(port);
            a.setExecutedCommand(command);
            a.setServerLedgerId(serverLedgerId);
            a.setStatus(success ? "SUCCESS" : "FAILURE");
            a.setErrorMessage(success ? null : errorMessage);
            if (executionResult != null) {
                String t = executionResult;
                if (t.length() > maxPayloadBytes) {
                    t = t.substring(0, maxPayloadBytes) + "…[truncated]";
                    a.setResultTruncated(true);
                } else {
                    a.setResultTruncated(false);
                }
                a.setResultBody(t);
            } else {
                a.setResultTruncated(false);
            }
            skillSshInvocationAuditMapper.insert(a);
        } catch (Exception e) {
            log.warn("skill ssh invocation audit save failed", e);
        }
    }

    private String correlationOrGenerated() {
        String c = AuditPrincipalResolver.currentCorrelationId();
        if (c != null && !StringUtils.isBlank(c)) {
            String t = c.trim();
            if (t.length() > 64) {
                return t.substring(0, 64);
            }
            return t;
        }
        return UUID.randomUUID().toString();
    }
}
