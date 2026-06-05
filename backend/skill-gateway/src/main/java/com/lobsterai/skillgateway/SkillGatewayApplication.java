package com.lobsterai.skillgateway;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Skill Gateway 应用程序入口类。
 * <p>
 * 这是一个基于 Spring Boot 的微服务，作为 BXDC.bot 平台的业务控制层。
 * 它负责管理用户权限、执行实际的 SSH/API 操作，并作为 Agent Core 的上游调度器。
 * </p>
 */
@SpringBootApplication
@EnableScheduling
@MapperScan("com.lobsterai.skillgateway.mapper")
public class SkillGatewayApplication {

    /**
     * 应用程序主入口点。
     *
     * @param args 命令行参数
     */
    public static void main(String[] args) {
        SpringApplication.run(SkillGatewayApplication.class, args);
    }

}
