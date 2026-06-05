package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.dto.AsyncTaskNotificationDto;
import com.lobsterai.skillgateway.service.AsyncTaskPollingService;
import com.lobsterai.skillgateway.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 异步任务通知中心 Controller。
 *
 * 仅返回走 asyncPoll 分支创建的异步任务（poll_endpoint IS NOT NULL）。
 * 通过 X-User-Id 头识别用户，所有查询按 user_id 过滤，避免跨用户泄露。
 */
@RestController
@RequestMapping("/api/async-tasks")
@CrossOrigin(origins = "*")
public class AsyncTaskNotificationController {

    private static final Logger log = LoggerFactory.getLogger(AsyncTaskNotificationController.class);

    private final AsyncTaskPollingService asyncTaskPollingService;

    public AsyncTaskNotificationController(AsyncTaskPollingService asyncTaskPollingService) {
        this.asyncTaskPollingService = asyncTaskPollingService;
    }

    @GetMapping("/my")
    public ResponseEntity<?> listMy(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestParam(value = "unreadOnly", defaultValue = "false") boolean unreadOnly,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        if (StringUtils.isBlank(userId)) {
            return ResponseEntity.badRequest().body(error("missing X-User-Id header"));
        }
        if (limit <= 0 || limit > 200) limit = 20;
        List<AsyncTaskNotificationDto> items = asyncTaskPollingService.findNotificationsByUser(userId, unreadOnly, limit);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items);
        body.put("count", items.size());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/my/unread-count")
    public ResponseEntity<?> unreadCount(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (StringUtils.isBlank(userId)) {
            return ResponseEntity.badRequest().body(error("missing X-User-Id header"));
        }
        int count = asyncTaskPollingService.countUnreadByUser(userId);
        Map<String, Object> body = new HashMap<>();
        body.put("count", count);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{id}/ack")
    public ResponseEntity<?> acknowledge(
            @PathVariable("id") Long taskId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (StringUtils.isBlank(userId)) {
            return ResponseEntity.badRequest().body(error("missing X-User-Id header"));
        }
        int affected = asyncTaskPollingService.markRead(taskId, userId);
        Map<String, Object> body = new HashMap<>();
        body.put("ok", affected > 0);
        body.put("affected", affected);
        return ResponseEntity.ok(body);
    }

    /**
     * 单条删除任务。仅允许删除属于自己的任务。
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteOne(
            @PathVariable("id") Long taskId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (StringUtils.isBlank(userId)) {
            return ResponseEntity.badRequest().body(error("missing X-User-Id header"));
        }
        int affected = asyncTaskPollingService.deleteByIdAndUser(taskId, userId);
        Map<String, Object> body = new HashMap<>();
        body.put("ok", affected > 0);
        body.put("affected", affected);
        return ResponseEntity.ok(body);
    }

    /**
     * 批量删除任务。请求体：{ "ids": [1, 2, 3] }
     */
    @PostMapping("/batch-delete")
    public ResponseEntity<?> batchDelete(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (StringUtils.isBlank(userId)) {
            return ResponseEntity.badRequest().body(error("missing X-User-Id header"));
        }
        Object idsObj = body.get("ids");
        if (!(idsObj instanceof java.util.List)) {
            return ResponseEntity.badRequest().body(error("ids must be a JSON array"));
        }
        java.util.List<Long> ids = new java.util.ArrayList<>();
        for (Object o : (java.util.List<?>) idsObj) {
            if (o instanceof Number) {
                ids.add(((Number) o).longValue());
            } else if (o instanceof String) {
                try {
                    ids.add(Long.parseLong((String) o));
                } catch (NumberFormatException ignore) {
                    // 跳过非数字项
                }
            }
        }
        int affected = asyncTaskPollingService.deleteByIdsAndUser(userId, ids);
        Map<String, Object> resp = new HashMap<>();
        resp.put("ok", true);
        resp.put("affected", affected);
        resp.put("requested", ids.size());
        return ResponseEntity.ok(resp);
    }

    private static Map<String, Object> error(String msg) {
        return Collections.singletonMap("error", msg);
    }
}
