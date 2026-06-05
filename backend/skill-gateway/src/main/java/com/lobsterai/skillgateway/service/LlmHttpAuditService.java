package com.lobsterai.skillgateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lobsterai.skillgateway.entity.LlmHttpAuditLog;
import com.lobsterai.skillgateway.mapper.LlmHttpAuditLogMapper;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Service
public class LlmHttpAuditService {

    private final LlmHttpAuditLogMapper llmHttpAuditLogMapper;

    @Value("${app.llm-http-audit.max-payload-bytes:1048576}")
    private int maxPayloadBytes;

    public LlmHttpAuditService(LlmHttpAuditLogMapper llmHttpAuditLogMapper) {
        this.llmHttpAuditLogMapper = llmHttpAuditLogMapper;
    }

    @Transactional
    public void saveEvent(JsonNode payload) {
        if (payload == null || payload.isNull()) {
            return;
        }
        String raw = payload.toString();
        byte[] utf8 = raw.getBytes(StandardCharsets.UTF_8);
        if (utf8.length > maxPayloadBytes) {
            throw new IllegalArgumentException("payload too large");
        }
        String correlationId = textOrEmpty(payload, "correlationId");
        if (correlationId.isEmpty()) {
            throw new IllegalArgumentException("correlationId required");
        }
        String direction = textOrEmpty(payload, "direction");
        if (direction.isEmpty()) {
            throw new IllegalArgumentException("direction required");
        }
        String userId = nullableText(payload, "userId");
        String sessionId = nullableText(payload, "sessionId");

        LlmHttpAuditLog row = new LlmHttpAuditLog();
        row.setUserId(userId);
        row.setSessionId(sessionId);
        row.setCorrelationId(correlationId);
        row.setDirection(direction);
        row.setRecordedAt(Instant.now());
        row.setPayloadJson(raw);
        llmHttpAuditLogMapper.insert(row);
    }

    private static String textOrEmpty(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? "" : v.asText("");
    }

    private static String nullableText(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        String s = v.asText();
        return StringUtils.isBlank(s) ? null : s;
    }
}
