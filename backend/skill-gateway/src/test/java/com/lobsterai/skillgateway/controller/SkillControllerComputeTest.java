package com.lobsterai.skillgateway.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.ZoneId;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Compute 端点单元测试。
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:skill_compute_test;DB_CLOSE_DELAY=-1;MODE=LEGACY",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=password",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:schema-h2.sql"
})
@AutoConfigureMockMvc
class SkillControllerComputeTest {

    private static final String TOKEN = "your-secure-token-here";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void add() throws Exception {
        String body = "{\"operation\":\"add\",\"operands\":[3,5]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(8.0));
    }

    @Test
    void subtract() throws Exception {
        String body = "{\"operation\":\"subtract\",\"operands\":[10,3]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(7.0));
    }

    @Test
    void multiply() throws Exception {
        String body = "{\"operation\":\"multiply\",\"operands\":[4,7]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(28.0));
    }

    @Test
    void divide() throws Exception {
        String body = "{\"operation\":\"divide\",\"operands\":[15,3]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(5.0));
    }

    @Test
    void divideByZero_returnsError() throws Exception {
        String body = "{\"operation\":\"divide\",\"operands\":[1,0]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error").value("division by zero"));
    }

    @Test
    void factorial() throws Exception {
        String body = "{\"operation\":\"factorial\",\"operands\":[5]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("120"));
    }

    @Test
    void factorialNegative_returnsError() throws Exception {
        String body = "{\"operation\":\"factorial\",\"operands\":[-1]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void square() throws Exception {
        String body = "{\"operation\":\"square\",\"operands\":[6]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(36.0));
    }

    @Test
    void sqrt() throws Exception {
        String body = "{\"operation\":\"sqrt\",\"operands\":[16]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(4.0));
    }

    @Test
    void sqrtNegative_returnsError() throws Exception {
        String body = "{\"operation\":\"sqrt\",\"operands\":[-1]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void timestampToDate_milliseconds() throws Exception {
        // 2024-01-15 00:00:00 UTC in ms
        long ts = 1705276800000L;
        String body = "{\"operation\":\"timestamp_to_date\",\"operands\":[" + ts + "]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").exists())
                .andExpect(jsonPath("$.result").isNotEmpty());
    }

    @Test
    void timestampToDate_seconds() throws Exception {
        String expectedDate = Instant.ofEpochSecond(1773013121L)
                .atZone(ZoneId.systemDefault())
                .toLocalDate()
                .toString();
        String body = "{\"operation\":\"timestamp_to_date\",\"operands\":[1773013121]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(expectedDate));
    }

    @Test
    void dateDiffDays() throws Exception {
        String body = "{\"operation\":\"date_diff_days\",\"operands\":[\"2026-03-08\",\"2026-03-12\"]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(4));
    }

    @Test
    void dateDiffDays_invalidDate_returnsError() throws Exception {
        String body = "{\"operation\":\"date_diff_days\",\"operands\":[\"bad-date\",\"2026-03-12\"]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error").value("invalid date operand: bad-date"));
    }

    @Test
    void unknownOperation_returnsError() throws Exception {
        String body = "{\"operation\":\"invalid_op\",\"operands\":[1]}";
        mockMvc.perform(post("/api/skills/compute")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void withoutToken_returns401() throws Exception {
        String body = "{\"operation\":\"add\",\"operands\":[1,2]}";
        mockMvc.perform(post("/api/skills/compute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }
}
