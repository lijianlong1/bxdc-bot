-- ============================================================
-- 异步轮询任务表
-- 部署日期: 2026-05-14
-- 对应 spec: api-skill-long-running-support
-- ============================================================

-- 新建表
CREATE TABLE IF NOT EXISTS async_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    skill_id BIGINT,
    user_id VARCHAR(64),
    external_task_id VARCHAR(255),
    poll_endpoint VARCHAR(1024),
    poll_method VARCHAR(16) DEFAULT 'GET',
    poll_interval_seconds INT DEFAULT 5,
    max_wait_seconds INT,
    completion_json_path VARCHAR(255),
    completion_value VARCHAR(64),
    failed_values TEXT COMMENT 'JSON array of failure status values',
    result_json_path VARCHAR(255),
    poll_headers TEXT COMMENT 'JSON, polling request headers',
    initial_response MEDIUMTEXT,
    poll_result MEDIUMTEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    poll_retry_count INT DEFAULT 0 COMMENT 'consecutive poll failure count; reset on success',
    last_polled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_async_status (status),
    INDEX idx_async_skill_id (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 存量表加列（表已存在时执行；若列已存在则跳过）
ALTER TABLE async_tasks ADD COLUMN poll_retry_count INT DEFAULT 0 COMMENT 'consecutive poll failure count';
