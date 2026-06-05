package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.service.ServerLedgerService;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/server-ledgers")
@CrossOrigin(origins = "*")
public class ServerLedgerController {

    private final ServerLedgerService serverLedgerService;

    public ServerLedgerController(ServerLedgerService serverLedgerService) {
        this.serverLedgerService = serverLedgerService;
    }

    private String getUserId(Map<String, String> headers) {
        String userId = null;
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if ("x-user-id".equalsIgnoreCase(e.getKey())) {
                userId = e.getValue();
                break;
            }
        }
        if (userId == null || StringUtils.isBlank(userId)) {
            throw new IllegalArgumentException("X-User-Id header is required");
        }
        return userId;
    }

    @GetMapping
    public ResponseEntity<?> getAllServerLedgers(@RequestHeader Map<String, String> headers) {
        try {
            String userId = getUserId(headers);
            List<ServerLedger> ledgers = serverLedgerService.getServerLedgers(userId);
            // Mask passwords in response
            List<Map<String, Object>> response = ledgers.stream().map(l -> {
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", l.getId());
                map.put("name", l.getName());
                map.put("host", l.getHost() != null ? l.getHost() : "");
                map.put("port", l.getPort() != null ? l.getPort() : 22);
                map.put("username", l.getUsername() != null ? l.getUsername() : "");
                map.put("hasPassword", l.getPassword() != null && !l.getPassword().isEmpty());
                map.put("hasPrivateKeyPath", l.getPrivateKeyPath() != null && !StringUtils.isBlank(l.getPrivateKeyPath()));
                map.put("createdAt", l.getCreatedAt() != null ? l.getCreatedAt().toString() : "");
                map.put("updatedAt", l.getUpdatedAt() != null ? l.getUpdatedAt().toString() : "");
                return map;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createServerLedger(@RequestHeader Map<String, String> headers, @RequestBody ServerLedger ledger) {
        try {
            String userId = getUserId(headers);
            return ResponseEntity.ok(serverLedgerService.createServerLedger(userId, ledger));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateServerLedger(@RequestHeader Map<String, String> headers, @PathVariable Long id, @RequestBody ServerLedger ledger) {
        try {
            String userId = getUserId(headers);
            return ResponseEntity.ok(serverLedgerService.updateServerLedger(userId, id, ledger));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteServerLedger(@RequestHeader Map<String, String> headers, @PathVariable Long id) {
        try {
            String userId = getUserId(headers);
            serverLedgerService.deleteServerLedger(userId, id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}
