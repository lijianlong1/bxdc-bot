package com.lobsterai.skillgateway.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lobsterai.skillgateway.entity.AsyncPollingAuditLog;
import com.lobsterai.skillgateway.entity.AsyncTask;
import com.lobsterai.skillgateway.mapper.AsyncPollingAuditLogMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AsyncPollingAuditService {

    private static final Logger log = LoggerFactory.getLogger(AsyncPollingAuditService.class);

    private final AsyncPollingAuditLogMapper mapper;
    private final ObjectMapper objectMapper;

    public AsyncPollingAuditService(AsyncPollingAuditLogMapper mapper, ObjectMapper objectMapper) {
        this.mapper = mapper;
        this.objectMapper = objectMapper;
    }

    public void log(AsyncPollingAuditLog entry) {
        try {
            if (entry.getRecordedAt() == null) {
                entry.setRecordedAt(LocalDateTime.now());
            }
            mapper.insert(entry);
        } catch (Exception e) {
            log.warn("Failed to write polling audit log for task {} phase {}: {}",
                    entry.getAsyncTaskId(), entry.getPhase(), e.getMessage());
        }
    }

    public void batchLog(List<AsyncPollingAuditLog> entries) {
        if (entries == null || entries.isEmpty()) return;
        for (AsyncPollingAuditLog entry : entries) {
            log(entry);
        }
    }

    public AsyncPollingAuditLog buildBaseLog(AsyncTask task, String phase) {
        AsyncPollingAuditLog entry = new AsyncPollingAuditLog();
        entry.setAsyncTaskId(task.getId());
        entry.setSkillId(task.getSkillId());
        entry.setUserId(task.getUserId());
        entry.setSessionId(task.getSessionId());
        entry.setPhase(phase);
        entry.setRecordedAt(LocalDateTime.now());
        return entry;
    }

    public String safeJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return obj.toString();
        }
    }

    public String truncate(String value, int maxLen) {
        if (value == null) return null;
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }

    public String getLatestNetworkResponse(Long asyncTaskId, int maxChars) {
        AsyncPollingAuditLog latest = mapper.findLatestNetworkResponseByTaskId(asyncTaskId);
        if (latest == null || latest.getResponseBody() == null) return null;
        return truncate(latest.getResponseBody(), maxChars);
    }

    public List<Map<String, Object>> getNetworkResponses(Long asyncTaskId, int maxChars) {
        List<AsyncPollingAuditLog> logs = mapper.findNetworkResponsesByTaskId(asyncTaskId);
        List<Map<String, Object>> result = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm:ss");
        for (AsyncPollingAuditLog log : logs) {
            if (log.getResponseBody() == null) continue;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("time", log.getRecordedAt() != null ? log.getRecordedAt().format(fmt) : "");
            entry.put("body", truncate(log.getResponseBody(), maxChars));
            result.add(entry);
        }
        return result;
    }
}
