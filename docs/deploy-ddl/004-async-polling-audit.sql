-- ============================================================
-- 异步轮询审计日志表 + async_tasks 新增 session_id
-- 部署日期: 2026-05-20
-- 对应 spec: async-polling-audit-log
-- ============================================================

-- 1. 审计日志表（全新）
CREATE TABLE IF NOT EXISTS async_polling_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    async_task_id BIGINT NOT NULL,
    skill_id BIGINT,
    user_id VARCHAR(128),
    session_id VARCHAR(128),
    phase VARCHAR(32) NOT NULL COMMENT 'AGENT_REQUEST|GATEWAY_POLL_START|NETWORK_REQUEST|NETWORK_ERROR|EVALUATION|GATEWAY_POLL_COMPLETE|AGENT_RESPONSE|AGENT_ERROR',
    recorded_at DATETIME(3) NOT NULL,
    duration_ms INT COMMENT 'phase duration in milliseconds',
    http_method VARCHAR(16),
    http_url VARCHAR(2048),
    http_status_code INT,
    request_headers_json TEXT COMMENT 'sanitized request headers JSON',
    request_body LONGTEXT COMMENT 'request body (truncated)',
    response_body MEDIUMTEXT COMMENT 'response body (truncated)',
    response_truncated TINYINT(1) NOT NULL DEFAULT 0,
    completion_evaluated TINYINT(1) DEFAULT 0,
    completion_expected_value VARCHAR(128),
    completion_actual_value VARCHAR(128),
    completion_matched TINYINT(1),
    failed_evaluated TINYINT(1) DEFAULT 0,
    failed_matched TINYINT(1),
    expired_evaluated TINYINT(1) DEFAULT 0,
    expired TINYINT(1),
    status VARCHAR(32) COMMENT 'current task status at this point',
    error_message TEXT,
    error_stack TEXT,
    extra_json TEXT COMMENT 'additional context JSON',
    INDEX idx_apal_task (async_task_id),
    INDEX idx_apal_user_time (user_id, recorded_at),
    INDEX idx_apal_skill (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. async_tasks 表新增 session_id（存量表加列）
ALTER TABLE async_tasks ADD COLUMN session_id VARCHAR(128) DEFAULT NULL AFTER user_id;
