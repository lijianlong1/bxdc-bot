package com.lobsterai.skillgateway.controller;

import com.lobsterai.skillgateway.entity.User;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserControllerProfileTest {

    private MockMvc mockMvc;

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(userController).build();
    }

    @Test
    void updateProfile_ok_whenSelfHeader() throws Exception {
        User u = new User();
        u.setId("123456");
        u.setNickname("n");
        u.setAvatar("🐱");
        when(userService.updateProfile(eq("123456"), eq("new"), eq("🐶"))).thenReturn(u);

        mockMvc.perform(put("/api/user/123456/profile")
                        .header("X-User-Id", "123456")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"new\",\"avatar\":\"🐶\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("123456"));

        verify(userService).updateProfile("123456", "new", "🐶");
    }

    @Test
    void updateProfile_403_whenHeaderMismatch() throws Exception {
        mockMvc.perform(put("/api/user/123456/profile")
                        .header("X-User-Id", "999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateProfile_403_whenHeaderMissing() throws Exception {
        mockMvc.perform(put("/api/user/123456/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateProfile_400_whenBodyContainsId() throws Exception {
        mockMvc.perform(put("/api/user/123456/profile")
                        .header("X-User-Id", "123456")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"999999\",\"nickname\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("id cannot be changed"));
    }

    @Test
    void updateProfile_400_whenNicknameInvalid() throws Exception {
        when(userService.updateProfile(eq("123456"), any(), any()))
                .thenThrow(new IllegalArgumentException("Nickname must be no longer than 10 characters."));

        mockMvc.perform(put("/api/user/123456/profile")
                        .header("X-User-Id", "123456")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"abcdefghijk\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Nickname must be no longer than 10 characters."));
    }

    @Test
    void updateAvatar_403_whenHeaderMismatch() throws Exception {
        mockMvc.perform(put("/api/user/123456/avatar")
                        .header("X-User-Id", "999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"avatar\":\"🐱\"}"))
                .andExpect(status().isForbidden());
    }
}
