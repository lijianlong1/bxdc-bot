package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.service.LinuxScriptExecutionService;
import com.lobsterai.skillgateway.service.SSHExecutorService;
import com.lobsterai.skillgateway.service.ServerLedgerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SkillControllerSshLedgerTest {

    private static final String TOKEN = "your-secure-token-here";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ServerLedgerService serverLedgerService;

    @MockBean
    private LinuxScriptExecutionService linuxScriptExecutionService;

    @MockBean
    private SSHExecutorService sshExecutorService;

    @Test
    void executeSshWithLedger_success() throws Exception {
        ServerLedger ledger = new ServerLedger();
        ledger.setName("myserver");
        ledger.setHost("192.168.1.1");
        ledger.setUsername("root");
        ledger.setPassword("p");
        ledger.setPort(22);

        when(serverLedgerService.getServerLedgerByName("123456", "myserver")).thenReturn(Optional.of(ledger));
        when(linuxScriptExecutionService.executeFromLedger(any(ServerLedger.class), eq("ls")))
                .thenReturn("file1.txt");

        mockMvc.perform(post("/api/skills/ssh")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "123456")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"host\":\"myserver\",\"command\":\"ls\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("file1.txt"));
    }

    @Test
    void executeSshWithLedger_notFound_returns400() throws Exception {
        when(serverLedgerService.getServerLedgerByName("123456", "myserver")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/skills/ssh")
                        .header("X-Agent-Token", TOKEN)
                        .header("X-User-Id", "123456")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"host\":\"myserver\",\"command\":\"ls\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void executeSshLegacy_success() throws Exception {
        when(sshExecutorService.executeCommand(eq("192.168.1.1"), eq(22), eq("user"), eq("key"), eq("ls")))
                .thenReturn("legacy");

        mockMvc.perform(post("/api/skills/ssh")
                        .header("X-Agent-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"host\":\"192.168.1.1\",\"username\":\"user\",\"privateKey\":\"key\",\"command\":\"ls\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("legacy"));
    }
}
