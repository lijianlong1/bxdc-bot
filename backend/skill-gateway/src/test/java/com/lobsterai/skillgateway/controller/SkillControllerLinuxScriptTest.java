package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.service.SSHExecutorService;
import com.lobsterai.skillgateway.service.ServerLedgerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SkillControllerLinuxScriptTest {

    private static final String TOKEN = "your-secure-token-here";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SSHExecutorService sshExecutorService;

    @MockBean
    private ServerLedgerService serverLedgerService;

    private void stubFullLedger() {
        ServerLedger ledger = new ServerLedger();
        ledger.setId(1L);
        ledger.setName("demo");
        ledger.setHost("127.0.0.1");
        ledger.setPort(22);
        ledger.setUsername("tester");
        ledger.setPrivateKeyPath("/tmp/test-key");
        when(serverLedgerService.getServerLedgerByUserIdAndId(anyString(), eq(1L))).thenReturn(Optional.of(ledger));
    }

    @Test
    void executeLinuxScript_success() throws Exception {
        stubFullLedger();
        when(sshExecutorService.executeCommand(
                eq("127.0.0.1"),
                eq(22),
                eq("tester"),
                eq("/tmp/test-key"),
                eq("echo hello")
        )).thenReturn("hello");

        mockMvc.perform(post("/api/skills/linux-script")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1,\"command\":\"echo hello\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("hello"));
    }

    @Test
    void executeLinuxScript_unknownServer_returns404() throws Exception {
        when(serverLedgerService.getServerLedgerByUserIdAndId(anyString(), eq(1L))).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/skills/linux-script")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1,\"command\":\"echo hello\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Unknown server id: 1"));
    }

    @Test
    void executeLinuxScript_incompleteLedger_returns400() throws Exception {
        ServerLedger ledger = new ServerLedger();
        ledger.setId(1L);
        ledger.setName("demo");
        ledger.setHost("127.0.0.1");
        ledger.setUsername("u");
        when(serverLedgerService.getServerLedgerByUserIdAndId(anyString(), eq(1L))).thenReturn(Optional.of(ledger));

        mockMvc.perform(post("/api/skills/linux-script")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1,\"command\":\"echo hello\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(
                        "Server ledger has no authentication: set password or private key path"));
    }

    @Test
    void executeLinuxScript_blockedCommand_returns400() throws Exception {
        stubFullLedger();
        mockMvc.perform(post("/api/skills/linux-script")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1,\"command\":\"rm -rf /tmp/demo\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Command blocked by security policy"));
    }

    @Test
    void executeLinuxScript_connectionFailure_returns500() throws Exception {
        stubFullLedger();
        when(sshExecutorService.executeCommand(
                eq("127.0.0.1"),
                eq(22),
                eq("tester"),
                eq("/tmp/test-key"),
                eq("echo hello")
        )).thenThrow(new IOException("connection refused"));

        mockMvc.perform(post("/api/skills/linux-script")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1,\"command\":\"echo hello\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Linux script execution failed: connection refused"));
    }

    @Test
    void executeLinuxScript_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/skills/linux-script")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1,\"command\":\"echo hello\"}"))
                .andExpect(status().isUnauthorized());
    }
}
