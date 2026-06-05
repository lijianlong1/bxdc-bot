package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.ToolCallLog;
import com.lobsterai.skillgateway.service.ToolCallLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/internal")
public class ToolCallLogController {

    @Autowired
    private ToolCallLogService toolCallLogService;

    @PostMapping("/tool-call-logs")
    public ResponseEntity<?> createToolCallLog(@RequestBody ToolCallLog log) {
        if (log.getStartTime() == null) {
            log.setStartTime(LocalDateTime.now());
        }
        boolean saved = toolCallLogService.saveToolCallLog(log);
        if (saved) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.internalServerError().build();
        }
    }
}