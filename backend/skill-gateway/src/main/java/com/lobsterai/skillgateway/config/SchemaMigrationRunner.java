package com.lobsterai.skillgateway.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

/**
 * 数据库轻量级 schema 迁移器。
 *
 * Spring 的 schema-mysql.sql 使用 CREATE TABLE IF NOT EXISTS，
 * 不会给已存在的表添加新列。本组件在 DataSource 就绪后立即执行迁移，
 * 确保定时任务调度器启动前列已就绪。
 *
 * 实现 InitializingBean 是在 afterPropertiesSet() 阶段，
 * 比 ApplicationRunner 更早，且 DataSource 已就绪。
 *
 * 重复执行是幂等的，不引入第三方包（不替换 Flyway/Liquibase）。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SchemaMigrationRunner implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigrationRunner.class);

    private final DataSource dataSource;

    public SchemaMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            migrateAsyncTasks(conn);
        } catch (Exception e) {
            // 迁移失败不阻塞应用启动，但记录严重警告
            log.warn("[SchemaMigration] Migration failed: {}", e.getMessage());
        }
    }

    private void migrateAsyncTasks(Connection conn) {
        String table = "async_tasks";
        if (!tableExists(conn, table)) {
            log.debug("[SchemaMigration] Table {} does not exist yet (will be created by schema-mysql.sql)", table);
            return;
        }

        Set<String> existingColumns = getColumnNames(conn, table);
        Set<String> existingIndexes = getIndexNames(conn, table);

        // 1. notified_at 列
        ensureColumn(conn, table, "notified_at", existingColumns,
                "ALTER TABLE async_tasks ADD COLUMN notified_at DATETIME DEFAULT NULL " +
                "COMMENT '用户已读时间；NULL 表示尚未读'");

        // 2. idx_async_user_unread 索引
        ensureIndex(conn, table, "idx_async_user_unread", existingIndexes,
                "ALTER TABLE async_tasks ADD INDEX idx_async_user_unread (user_id, status, notified_at)");

        // 3. poll_strategy 列（原子 2：SINGLE_CALL 兼容）
        ensureColumn(conn, table, "poll_strategy", existingColumns,
                "ALTER TABLE async_tasks ADD COLUMN poll_strategy VARCHAR(20) DEFAULT 'PERIODIC' " +
                "COMMENT 'PERIODIC=周期轮询；SINGLE_CALL=单次长调用（无 pollEndpoint，靠 HTTP 长 readTimeout 等结果）'");

        // 4. single_call_read_timeout_seconds 列（原子 2）
        ensureColumn(conn, table, "single_call_read_timeout_seconds", existingColumns,
                "ALTER TABLE async_tasks ADD COLUMN single_call_read_timeout_seconds INT DEFAULT NULL " +
                "COMMENT 'SINGLE_CALL 模式专用 read timeout（秒）；NULL 时回退到 maxWaitSeconds'");

        // 5. request_signature 列（原子 3：去重）
        ensureColumn(conn, table, "request_signature", existingColumns,
                "ALTER TABLE async_tasks ADD COLUMN request_signature VARCHAR(64) DEFAULT NULL " +
                "COMMENT '请求签名 SHA-256 hex（去重用）'");

        // 6. idx_async_user_session_sig_time 索引（原子 3）
        ensureIndex(conn, table, "idx_async_user_session_sig_time", existingIndexes,
                "ALTER TABLE async_tasks ADD INDEX idx_async_user_session_sig_time (user_id, session_id, request_signature, created_at)");

        // 7. request_body 列（SINGLE_CALL 兼容：scheduler 发起长调用需要原始 body）
        ensureColumn(conn, table, "request_body", existingColumns,
                "ALTER TABLE async_tasks ADD COLUMN request_body MEDIUMTEXT DEFAULT NULL " +
                "COMMENT 'SINGLE_CALL 模式的原始请求体（JSON 字符串）；PERIODIC 模式为 NULL'");
    }

    private boolean tableExists(Connection conn, String table) {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        } catch (Exception e) {
            log.warn("[SchemaMigration] Failed to check table existence for {}: {}", table, e.getMessage());
        }
        return false;
    }

    private Set<String> getColumnNames(Connection conn, String table) {
        Set<String> cols = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    cols.add(rs.getString(1).toLowerCase());
                }
            }
        } catch (Exception e) {
            log.warn("[SchemaMigration] Failed to read columns for {}: {}", table, e.getMessage());
        }
        return cols;
    }

    private Set<String> getIndexNames(Connection conn, String table) {
        Set<String> idx = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    idx.add(rs.getString(1).toLowerCase());
                }
            }
        } catch (Exception e) {
            log.warn("[SchemaMigration] Failed to read indexes for {}: {}", table, e.getMessage());
        }
        return idx;
    }

    private void ensureColumn(Connection conn, String table, String column,
                              Set<String> existing, String alterSql) {
        if (existing.contains(column.toLowerCase())) {
            log.debug("[SchemaMigration] Column {}.{} already exists, skip", table, column);
            return;
        }
        try (Statement st = conn.createStatement()) {
            st.executeUpdate(alterSql);
            log.info("[SchemaMigration] ✅ Added column {}.{}", table, column);
        } catch (Exception e) {
            log.warn("[SchemaMigration] Failed to add column {}.{}: {}", table, column, e.getMessage());
        }
    }

    private void ensureIndex(Connection conn, String table, String indexName,
                             Set<String> existing, String alterSql) {
        if (existing.contains(indexName.toLowerCase())) {
            log.debug("[SchemaMigration] Index {} on {} already exists, skip", indexName, table);
            return;
        }
        try (Statement st = conn.createStatement()) {
            st.executeUpdate(alterSql);
            log.info("[SchemaMigration] ✅ Added index {} on {}", indexName, table);
        } catch (Exception e) {
            log.warn("[SchemaMigration] Failed to add index {} on {}: {}", indexName, table, e.getMessage());
        }
    }
}
