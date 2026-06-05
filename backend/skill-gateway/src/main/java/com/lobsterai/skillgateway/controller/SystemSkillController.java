package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.SystemSkill;
import com.lobsterai.skillgateway.service.SystemSkillService;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Collections;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 系统 Built-in Skill（独立于 {@code /api/skills} 扩展 CRUD）。
 * Agent 在 gateway 模式下通过本控制器发现与执行内置工具。
 */
@RestController
@RequestMapping("/api/system-skills")
@CrossOrigin(origins = "*")
public class SystemSkillController {

    private final SystemSkillService systemSkillService;

    public SystemSkillController(SystemSkillService systemSkillService) {
        this.systemSkillService = systemSkillService;
    }

    /**
     * 面向 Agent 的内置 Skill 列表（来源：{@code system_skills} 表）。
     */
    @GetMapping("/agent")
    public List<Map<String, Object>> listForAgent() {
        return systemSkillService.listAgentSkills().stream()
                .map(this::toAgentDto)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toAgentDto(SystemSkill s) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", s.getId());
        m.put("toolName", s.getToolName());
        m.put("description", s.getDescription());
        m.put("kind", s.getKind());
        m.put("source", "built-in");
        m.put("enabled", s.isEnabled());
        return m;
    }

    public static class ExecuteBody {
        private String toolName;
        private Map<String, Object> arguments;

        public String getToolName() {
            return toolName;
        }

        public void setToolName(String toolName) {
            this.toolName = toolName;
        }

        public Map<String, Object> getArguments() {
            return arguments;
        }

        public void setArguments(Map<String, Object> arguments) {
            this.arguments = arguments;
        }
    }

    @PostMapping("/execute")
    public ResponseEntity<?> execute(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestBody ExecuteBody body
    ) {
        if (body == null || body.getToolName() == null || StringUtils.isBlank(body.getToolName())) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "toolName is required"));
        }
        try {
            Object result = systemSkillService.execute(body.getToolName(), body.getArguments(), userId);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}
