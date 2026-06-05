package com.lobsterai.skillgateway.audit;
import com.lobsterai.skillgateway.util.StringUtils;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lobsterai.skillgateway.entity.GatewayOutboundAuditLog;
import com.lobsterai.skillgateway.entity.SkillSshInvocationAudit;
import com.lobsterai.skillgateway.mapper.GatewayOutboundAuditLogMapper;
import com.lobsterai.skillgateway.mapper.SkillSshInvocationAuditMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:gw_out_audit_test;DB_CLOSE_DELAY=-1;MODE=LEGACY",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=password",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:schema-h2.sql"
})
@AutoConfigureMockMvc
class GatewayOutboundAuditMvcTest {

    private static final String TOKEN = "your-secure-token-here";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private GatewayOutboundAuditLogMapper outboundAuditLogMapper;

    @Autowired
    private SkillSshInvocationAuditMapper skillSshInvocationAuditMapper;

    @BeforeEach
    void clean() {
        skillSshInvocationAuditMapper.delete(new LambdaQueryWrapper<>());
        outboundAuditLogMapper.delete(new LambdaQueryWrapper<>());
    }

    @Test
    void postSkillApi_persistsOutboundAuditWithRawOriginBody() throws Exception {
        String requestJson = "                {\"url\":\"http://127.0.0.1:1/nope\",\"method\":\"GET\",\"headers\":{}}";
        mockMvc.perform(post("/api/skills/api")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "audit-user-1")
                        .header("X-Skill-Id", "7")
                        .header(SkillIngressCaptureFilter.HEADER_CORRELATION_ID, "corr-it-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().is5xxServerError())
                .andExpect(header().string(SkillIngressCaptureFilter.HEADER_CORRELATION_ID, "corr-it-1"));

        List<GatewayOutboundAuditLog> rows = outboundAuditLogMapper.selectList(null);
        assertEquals(1, rows.size());
        GatewayOutboundAuditLog row = rows.get(0);
        assertEquals("corr-it-1", row.getCorrelationId());
        assertEquals("audit-user-1", row.getUserId());
        assertEquals("HTTP", row.getOutboundKind());
        assertEquals("FAILURE", row.getStatus());
        assertEquals(7L, row.getSkillId());
        assertTrue(row.getProxyRequestJson() != null && row.getProxyRequestJson().contains("127.0.0.1:1"));
        assertTrue(row.getDestination().contains("127.0.0.1:1"));
        assertTrue(row.getOutboundHeadersJson() != null && !StringUtils.isBlank(row.getOutboundHeadersJson()));
        String origin = new String(row.getOriginBody(), StandardCharsets.UTF_8);
        assertTrue(origin.contains("127.0.0.1:1"), () -> "origin body: " + origin);
    }

    @Test
    void postSkillApi_acceptsHeadersAsJsonArrays() throws Exception {
        String requestJson = "                {\"url\":\"http://127.0.0.1:1/nope\",\"method\":\"GET\",\"headers\":{\"Origin\":[\"http://brdp.cs.iicbc\"]},\"body\":\"\"}";
        mockMvc.perform(post("/api/skills/api")
                        .header("X-Agent-Token", TOKEN)
                        .header(SkillIngressCaptureFilter.HEADER_CORRELATION_ID, "corr-array-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().is5xxServerError());
    }

    @Test
    void postLinuxScript_unknownServer_insertsSshSkillAudit() throws Exception {
        mockMvc.perform(post("/api/skills/linux-script")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "ssh-audit-user")
                        .header("X-Skill-Id", "99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":999999,\"command\":\"ls\"}"))
                .andExpect(status().isNotFound());

        List<GatewayOutboundAuditLog> outRows = outboundAuditLogMapper.selectList(null);
        assertEquals(1, outRows.size());
        GatewayOutboundAuditLog row = outRows.get(0);
        assertEquals("SSH", row.getOutboundKind());
        assertEquals("FAILURE", row.getStatus());
        assertEquals(99L, row.getSkillId());
        assertEquals("skill.linux-script", row.getSkillContext());

        List<SkillSshInvocationAudit> sshRows = skillSshInvocationAuditMapper.selectList(null);
        assertEquals(1, sshRows.size());
        assertEquals(99L, sshRows.get(0).getSkillId());
        assertEquals("ssh-audit-user", sshRows.get(0).getUserId());
    }
}
