package com.lobsterai.skillgateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lobsterai.skillgateway.controller.SkillController;
import com.lobsterai.skillgateway.entity.SystemSkill;
import com.lobsterai.skillgateway.mapper.SystemSkillMapper;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
public class SystemSkillService {

    public static final String KIND_API_PROXY = "API_PROXY";
    public static final String KIND_COMPUTE = "COMPUTE";
    public static final String KIND_SSH_EXECUTOR = "SSH_EXECUTOR";

    private final SystemSkillMapper systemSkillMapper;
    private final BuiltinToolExecutionService builtinToolExecutionService;
    private final ObjectMapper objectMapper;

    public SystemSkillService(
            SystemSkillMapper systemSkillMapper,
            BuiltinToolExecutionService builtinToolExecutionService,
            ObjectMapper objectMapper
    ) {
        this.systemSkillMapper = systemSkillMapper;
        this.builtinToolExecutionService = builtinToolExecutionService;
        this.objectMapper = objectMapper;
    }

    public List<SystemSkill> listAgentSkills() {
        return systemSkillMapper.findByEnabledIsTrueOrderByToolNameAsc();
    }

    /**
     * 按 toolName 执行内置工具；arguments 形状与同路径直连 /api/skills/* 一致。
     */
    public Object execute(String toolName, Map<String, Object> arguments, String userId) throws Exception {
        SystemSkill skill = systemSkillMapper.findByToolNameAndEnabledIsTrue(toolName)
                .orElseThrow(() -> new IllegalArgumentException("Unknown or disabled system skill: " + toolName));
        Map<String, Object> args = arguments != null ? arguments : Collections.emptyMap();
        switch (skill.getKind()) {
            case KIND_API_PROXY: {
                SkillController.ApiRequest req = objectMapper.convertValue(args, SkillController.ApiRequest.class);
                return builtinToolExecutionService.callExternalApi(req);
            }
            case KIND_COMPUTE: {
                SkillController.ComputeRequest req = objectMapper.convertValue(args, SkillController.ComputeRequest.class);
                return builtinToolExecutionService.compute(req);
            }
            case KIND_SSH_EXECUTOR: {
                SkillController.SshRequest req = objectMapper.convertValue(args, SkillController.SshRequest.class);
                ResponseEntity<String> res = builtinToolExecutionService.executeSsh(req, userId);
                if (!res.getStatusCode().is2xxSuccessful()) {
                    return res.getBody() != null ? res.getBody() : "SSH execution failed";
                }
                return res.getBody();
            }
            default:
                throw new IllegalArgumentException("Unsupported system skill kind: " + skill.getKind());
        }
    }
}
