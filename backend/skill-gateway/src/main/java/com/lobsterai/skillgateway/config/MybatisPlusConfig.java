package com.lobsterai.skillgateway.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.TimeZone;

@Configuration
public class MybatisPlusConfig {

    /**
     * 启动时把 JVM 默认时区强制设为 UTC。
     *
     * 链路一致性：JVM TZ → MyBatis-Plus UTC 填充 → JDBC serverTimezone=UTC → MySQL DATETIME
     * → Jackson @JsonFormat(timezone="UTC") → 前端按 UTC 解析 + 本地时区显示。
     *
     * 任何一环不一致（比如 JVM 是 Asia/Shanghai、MySQL 也是 Asia/Shanghai），
     * LocalDateTime.now() 拿到的就是北京时间，写进 DATETIME 后被 Jackson 当 UTC
     * 发出去，前端再加 8 小时 → 整体"大 8 小时"。
     */
    @PostConstruct
    public void forceJvmUtc() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    @Bean
    public MetaObjectHandler metaObjectHandler() {
        return new MetaObjectHandler() {
            @Override
            public void insertFill(MetaObject metaObject) {
                // 写入时按 UTC 解释时刻。MySQL DATETIME 列无时区，
                // 通过 serverTimezone=UTC + "yyyy-MM-dd'T'HH:mm:ss'Z'" 序列化对齐。
                LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
                this.strictInsertFill(metaObject, "createdAt", LocalDateTime.class, nowUtc);
                this.strictInsertFill(metaObject, "updatedAt", LocalDateTime.class, nowUtc);
            }

            @Override
            public void updateFill(MetaObject metaObject) {
                this.strictUpdateFill(metaObject, "updatedAt", LocalDateTime.class, LocalDateTime.now(ZoneOffset.UTC));
            }
        };
    }
}
