package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.exception.RegistrationNotAllowedException;
import com.lobsterai.skillgateway.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Standalone MockMvc (no Spring Boot context) to avoid H2 file DB locks / JPA slice issues.
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerRegisterTest {

    private MockMvc mockMvc;

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthController authController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();
    }

    @Test
    void register_returns403_whenGateFails() throws Exception {
        when(userService.register(any(), any(), any()))
                .thenThrow(new RegistrationNotAllowedException());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"123456\",\"nickname\":\"nick\",\"systemAdminPassword\":\"x\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("暂无注册权限，请联系管理员获取授权凭据。"));
    }
}
