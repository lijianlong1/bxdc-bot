package com.lobsterai.skillgateway.controller;
import com.lobsterai.skillgateway.util.StringUtils;

import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private String version = "unknown";

    @PostConstruct
    private void loadVersion() {
        try {
            ClassPathResource resource = new ClassPathResource("VERSION");
            String raw = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
            this.version = raw.trim();
        } catch (Exception ignored) {
            this.version = "unknown";
        }
    }

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "ok");
        result.put("service", "skill-gateway");
        result.put("version", version);
        result.put("timestamp", Instant.now().toString());
        result.put("uptimeSeconds", Math.round(java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime() / 1000.0));
        return result;
    }
}
