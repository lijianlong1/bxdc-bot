package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.AsyncPollingAuditLog;
import com.lobsterai.skillgateway.service.AsyncPollingAuditService;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/internal/polling-audit")
public class PollingAuditController {

    private final AsyncPollingAuditService auditService;

    public PollingAuditController(AsyncPollingAuditService auditService) {
        this.auditService = auditService;
    }

    @PostMapping("/events")
    public ResponseEntity<?> receiveEvents(@RequestBody List<AsyncPollingAuditLog> entries) {
        if (entries == null || entries.isEmpty()) {
            return ResponseEntity.ok(new HashMap<String, Object>() {{
            put("ok", true);
            put("count", 0);
        }});
        }
        auditService.batchLog(entries);
        return ResponseEntity.ok(new HashMap<String, Object>() {{
            put("ok", true);
            put("count", entries.size());
        }});
    }
}
