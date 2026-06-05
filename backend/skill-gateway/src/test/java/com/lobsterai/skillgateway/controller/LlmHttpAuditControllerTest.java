package com.lobsterai.skillgateway.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lobsterai.skillgateway.entity.LlmHttpAuditLog;
import com.lobsterai.skillgateway.mapper.LlmHttpAuditLogMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:llm_http_audit_test;DB_CLOSE_DELAY=-1;MODE=LEGACY",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=password",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:schema-h2.sql"
})
@AutoConfigureMockMvc
class LlmHttpAuditControllerTest {

    private static final String TOKEN = "your-secure-token-here";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LlmHttpAuditLogMapper llmHttpAuditLogMapper;

    @AfterEach
    void cleanup() {
        llmHttpAuditLogMapper.delete(new LambdaQueryWrapper<>());
    }

    @Test
    void post_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/internal/llm-http-audit/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correlationId\":\"c1\",\"direction\":\"request\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void post_withToken_persistsRow() throws Exception {
        mockMvc.perform(post("/api/internal/llm-http-audit/events")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("                                {                                  \"ts\": \"2026-01-01T00:00:00.000Z\",                                  \"direction\": \"request\",                                  \"correlationId\": \"corr-test\",                                  \"userId\": \"u42\",                                  \"sessionId\": \"s99\",                                  \"method\": \"POST\",                                  \"url\": \"https://example.com/v1/chat/completions\"                                }"))
                .andExpect(status().isCreated());

        assertThat(llmHttpAuditLogMapper.selectCount(null)).isEqualTo(1);
        LlmHttpAuditLog row = llmHttpAuditLogMapper.selectList(null).get(0);
        assertThat(row.getCorrelationId()).isEqualTo("corr-test");
        assertThat(row.getUserId()).isEqualTo("u42");
        assertThat(row.getSessionId()).isEqualTo("s99");
        assertThat(row.getDirection()).isEqualTo("request");
        assertThat(row.getRecordedAt()).isNotNull();
        assertThat(row.getPayloadJson()).contains("corr-test");
    }
}
