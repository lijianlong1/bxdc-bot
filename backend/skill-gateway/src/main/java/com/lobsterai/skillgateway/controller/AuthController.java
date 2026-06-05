package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.User;
import com.lobsterai.skillgateway.exception.RegistrationNotAllowedException;
import com.lobsterai.skillgateway.service.UserService;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Allow CORS for frontend
public class AuthController {
    
    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        String id = payload.get("id");
        String nickname = payload.get("nickname");
        String systemAdminPassword = payload.get("systemAdminPassword");

        try {
            User user = userService.register(id, nickname, systemAdminPassword);
            return ResponseEntity.ok(user);
        } catch (RegistrationNotAllowedException e) {
            return ResponseEntity.status(403).body(Collections.singletonMap("error", "暂无注册权限，请联系管理员获取授权凭据。"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Collections.singletonMap("error", "Registration failed"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String id = payload.get("id");
        if (id == null || (id = id.trim()).isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "ID is required"));
        }

        User user = userService.login(id);
        if (user == null) {
            return ResponseEntity.status(401).body(Collections.singletonMap("error", "Invalid User ID"));
        }
        return ResponseEntity.ok(user);
    }
}
