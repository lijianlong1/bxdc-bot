package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.Skill;
import com.lobsterai.skillgateway.entity.SkillVisibility;
import com.lobsterai.skillgateway.mapper.SkillMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lobsterai.skillgateway.service.SkillService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:skill_crud_test;DB_CLOSE_DELAY=-1;MODE=LEGACY",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=password",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:schema-h2.sql"
})
@AutoConfigureMockMvc
class SkillControllerCrudTest {

    private static final String TOKEN = "your-secure-token-here";
    private static final String USER_ID = "test-user-crud";
    private static final String TEST_SKILL_PREFIX = "crud-test-skill-";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SkillMapper skillMapper;

    @AfterEach
    void cleanup() {
        skillMapper.selectList(null).stream()
                .filter(skill -> skill.getName() != null && skill.getName().startsWith(TEST_SKILL_PREFIX))
                .forEach(skill -> skillMapper.deleteById(skill.getId()));
    }

    @Test
    void getAllSkills_withoutUser_isEmptyWhenNoPublicExtensions() throws Exception {
        mockMvc.perform(get("/api/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void createUpdateDeleteSkill_roundTrip() throws Exception {
        String skillName = TEST_SKILL_PREFIX + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Created by CRUD integration test\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(skillName))
                .andExpect(jsonPath("$.executionMode").value("CONFIG"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.requiresConfirmation").value(false));

        Skill createdSkill = skillMapper.selectOne(new LambdaQueryWrapper<Skill>().eq(Skill::getName, skillName));
        if (createdSkill == null) throw new IllegalStateException("Created skill not found");

        String updateBody = "                {                  \"name\": \"%s\",                  \"description\": \"Updated by CRUD integration test\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"OPENCLAW\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"openclaw\\\\\",\\\\\"systemPrompt\\\\\":\\\\\"## Planner: use tools carefully\\\\\",\\\\\"allowedTools\\\\\":[\\\\\"compute\\\\\",\\\\\"获取时间\\\\\"],\\\\\"orchestration\\\\\":{\\\\\"mode\\\\\":\\\\\"serial\\\\\"}}\",                  \"enabled\": false,                  \"requiresConfirmation\": true                }".formatted(skillName);

        mockMvc.perform(put("/api/skills/{id}", createdSkill.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Updated by CRUD integration test"))
                .andExpect(jsonPath("$.executionMode").value("OPENCLAW"))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.requiresConfirmation").value(true));

        mockMvc.perform(delete("/api/skills/{id}", createdSkill.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/skills/{id}", createdSkill.getId()))
                .andExpect(status().isNotFound());
    }

    @Test
    void createSkill_defaultsExecutionModeToConfigWhenMissing() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "default-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Defaults execution mode\",                  \"type\": \"EXTENSION\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executionMode").value("CONFIG"));
    }

    @Test
    void createSkill_rejectsExecutionModeAndConfigurationMismatch() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "invalid-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Invalid openclaw payload\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"OPENCLAW\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"monitor\\\\\",\\\\\"operation\\\\\":\\\\\"server-resource-status\\\\\",\\\\\"lookup\\\\\":\\\\\"server_lookup\\\\\",\\\\\"executor\\\\\":\\\\\"ssh_executor\\\\\",\\\\\"command\\\\\":\\\\\"uptime\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("OPENCLAW executionMode requires kind=openclaw"));
    }

    @Test
    void createSkill_allowsOpenclawWithoutAllowedTools() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "prompt-only-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Prompt only openclaw\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"OPENCLAW\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"openclaw\\\\\",\\\\\"systemPrompt\\\\\":\\\\\"# Prompt only\\\\\",\\\\\"allowedTools\\\\\":[],\\\\\"orchestration\\\\\":{\\\\\"mode\\\\\":\\\\\"serial\\\\\"}}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executionMode").value("OPENCLAW"))
                .andExpect(jsonPath("$.configuration").value("{\"kind\":\"openclaw\",\"systemPrompt\":\"# Prompt only\",\"allowedTools\":[],\"orchestration\":{\"mode\":\"serial\"}}"));
    }

    @Test
    void createSkill_legacyTimeKindIsNormalizedToCanonicalApiKind() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "legacy-time-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Legacy time config\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configuration").value("{\"kind\":\"api\",\"operation\":\"current-time\",\"method\":\"GET\",\"endpoint\":\"https://example.com/time\",\"preset\":\"current-time\"}"));
    }

    @Test
    void createSkill_acceptsCanonicalSshPresetConfig() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "canonical-ssh-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Canonical ssh config\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"ssh\\\\\",\\\\\"preset\\\\\":\\\\\"server-resource-status\\\\\",\\\\\"operation\\\\\":\\\\\"server-resource-status\\\\\",\\\\\"lookup\\\\\":\\\\\"server_lookup\\\\\",\\\\\"executor\\\\\":\\\\\"ssh_executor\\\\\",\\\\\"command\\\\\":\\\\\"uptime\\\\\",\\\\\"readOnly\\\\\":true}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configuration").value("{\"kind\":\"ssh\",\"preset\":\"server-resource-status\",\"operation\":\"server-resource-status\",\"lookup\":\"server_lookup\",\"executor\":\"ssh_executor\",\"command\":\"uptime\",\"readOnly\":true}"));
    }

    @Test
    void createSkill_acceptsTemplateConfig() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "template-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"A reusable prompt template\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"template\\\\\",\\\\\"prompt\\\\\":\\\\\"你是一位专业的翻译助手。请将用户输入翻译为英文。\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executionMode").value("CONFIG"))
                .andExpect(jsonPath("$.configuration").value("{\"kind\":\"template\",\"prompt\":\"你是一位专业的翻译助手。请将用户输入翻译为英文。\"}"));
    }

    @Test
    void publicSkill_otherUserCannotUpdateOrDelete() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "pub-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"public skill\",                  \"type\": \"EXTENSION\",                  \"visibility\": \"PUBLIC\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "owner-alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk());

        Skill created = skillMapper.selectOne(new LambdaQueryWrapper<Skill>().eq(Skill::getName, skillName));
        if (created == null) throw new IllegalStateException("Created skill not found");

        String updateBody = "                {                  \"name\": \"%s\",                  \"description\": \"hijack\",                  \"type\": \"EXTENSION\",                  \"visibility\": \"PUBLIC\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(put("/api/skills/{id}", created.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "other-bob")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/skills/{id}", created.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "other-bob"))
                .andExpect(status().isNotFound());

        skillMapper.deleteById(created.getId());
    }

    @Test
    void platformPublicSkill_admin890728CanUpdateAndDelete() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "platform-" + System.nanoTime();
        Skill platform = new Skill();
        platform.setName(skillName);
        platform.setDescription("platform row");
        platform.setType("EXTENSION");
        platform.setExecutionMode("CONFIG");
        platform.setConfiguration(
                "{\"kind\":\"api\",\"operation\":\"current-time\",\"method\":\"GET\",\"endpoint\":\"https://example.com/time\",\"preset\":\"current-time\"}");
        platform.setEnabled(true);
        platform.setRequiresConfirmation(false);
        platform.setVisibility(SkillVisibility.PUBLIC);
        platform.setCreatedBy(SkillService.PLATFORM_PUBLIC_AUTHOR);
        skillMapper.insert(platform);
        Skill saved = platform;

        String updateBody = "                {                  \"name\": \"%s\",                  \"description\": \"updated by admin\",                  \"type\": \"EXTENSION\",                  \"visibility\": \"PUBLIC\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(put("/api/skills/{id}", saved.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", SkillService.SKILL_PLATFORM_ADMIN_USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("updated by admin"));

        mockMvc.perform(delete("/api/skills/{id}", saved.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", SkillService.SKILL_PLATFORM_ADMIN_USER_ID))
                .andExpect(status().isOk());
    }

    @Test
    void publicSkill_admin890728CannotEditOtherUsersSkill() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "alice-pub-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"alice public\",                  \"type\": \"EXTENSION\",                  \"visibility\": \"PUBLIC\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "owner-alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk());

        Skill created = skillMapper.selectOne(new LambdaQueryWrapper<Skill>().eq(Skill::getName, skillName));
        if (created == null) throw new IllegalStateException("Created skill not found");

        String updateBody = "                {                  \"name\": \"%s\",                  \"description\": \"admin hijack attempt\",                  \"type\": \"EXTENSION\",                  \"visibility\": \"PUBLIC\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"api\\\\\",\\\\\"preset\\\\\":\\\\\"current-time\\\\\",\\\\\"operation\\\\\":\\\\\"current-time\\\\\",\\\\\"method\\\\\":\\\\\"GET\\\\\",\\\\\"endpoint\\\\\":\\\\\"https://example.com/time\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(put("/api/skills/{id}", created.getId())
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", SkillService.SKILL_PLATFORM_ADMIN_USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isNotFound());

        skillMapper.deleteById(created.getId());
    }

    @Test
    void createSkill_rejectsTemplateWithEmptyPrompt() throws Exception {
        String skillName = TEST_SKILL_PREFIX + "template-empty-" + System.nanoTime();
        String createBody = "                {                  \"name\": \"%s\",                  \"description\": \"Template with empty prompt\",                  \"type\": \"EXTENSION\",                  \"executionMode\": \"CONFIG\",                  \"configuration\": \"{\\\\\"kind\\\\\":\\\\\"template\\\\\",\\\\\"prompt\\\\\":\\\\\"\\\\\"}\",                  \"enabled\": true,                  \"requiresConfirmation\": false                }".formatted(skillName);

        mockMvc.perform(post("/api/skills")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("prompt is required"));
    }
}
