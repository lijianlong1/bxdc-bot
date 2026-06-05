package com.lobsterai.skillgateway.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lobsterai.skillgateway.service.LlmHttpAuditService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * agent-core 上报 LLM 原始 HTTP 审计事件（经本服务写入数据库）。
 */
@RestController
@RequestMapping("/api/internal/llm-http-audit")
public class LlmHttpAuditController {

    private final LlmHttpAuditService llmHttpAuditService;

    public LlmHttpAuditController(LlmHttpAuditService llmHttpAuditService) {
        this.llmHttpAuditService = llmHttpAuditService;
    }

    @PostMapping("/events")
    public ResponseEntity<Void> ingest(@RequestBody JsonNode payload) {
        try {
            llmHttpAuditService.saveEvent(payload);
            return ResponseEntity.status(HttpStatus.CREATED).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
