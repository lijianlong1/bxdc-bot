package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.entity.User;
import com.lobsterai.skillgateway.exception.RegistrationNotAllowedException;
import com.lobsterai.skillgateway.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestPropertySource(
        properties = {
                "app.registration.admin-password=Bxdc1357",
                "spring.datasource.url=jdbc:h2:mem:register_gw_test;DB_CLOSE_DELAY=-1",
                "spring.sql.init.mode=always",
                "spring.sql.init.schema-locations=classpath:schema-h2.sql"
        }
)
@Transactional
class UserServiceRegisterGateTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserMapper userMapper;

    @Test
    void register_missingAdminPassword_throws() {
        assertThrows(RegistrationNotAllowedException.class,
                () -> userService.register("811001", "u", null));
    }

    @Test
    void register_wrongAdminPassword_throws() {
        assertThrows(RegistrationNotAllowedException.class,
                () -> userService.register("811002", "u", "wrong-password"));
    }

    @Test
    void register_correctGate_createsUser() {
        User u = userService.register("811003", "ok", "Bxdc1357");
        assertNotNull(u.getId());
        assertNotNull(userMapper.selectById("811003"));
    }

    @Test
    void register_correctGate_duplicateId_throws() {
        userService.register("811004", "first", "Bxdc1357");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userService.register("811004", "second", "Bxdc1357"));
        assertTrue(ex.getMessage().contains("exists"));
    }
}
