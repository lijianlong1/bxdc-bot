CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(6) PRIMARY KEY,
    nickname VARCHAR(255),
    avatar VARCHAR(255),
    created_at DATETIME,
    llm_api_base VARCHAR(512),
    llm_model_name VARCHAR(128),
    llm_api_key VARCHAR(2048)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(255) NOT NULL,
    configuration TEXT,
    execution_mode VARCHAR(255) DEFAULT 'CONFIG',
    enabled TINYINT(1) DEFAULT 1,
    requires_confirmation TINYINT(1) NOT NULL DEFAULT 0,
    visibility VARCHAR(16) NOT NULL DEFAULT 'PUBLIC',
    avatar VARCHAR(32),
    created_by VARCHAR(128),
    created_at DATETIME,
    updated_at DATETIME,
    schema_properties TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(255),
    skill_name VARCHAR(255),
    command_or_url VARCHAR(255),
    params TEXT,
    status VARCHAR(255),
    timestamp DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS server_ledgers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255),
    port INT,
    username VARCHAR(255),
    password VARCHAR(255),
    private_key_path VARCHAR(255),
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE KEY uk_server_ledgers_user_name (user_id, name),
    UNIQUE KEY uk_server_ledgers_user_host (user_id, host)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tool_name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    kind VARCHAR(32) NOT NULL,
    configuration TEXT,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    schema_version INT DEFAULT 1,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gateway_outbound_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    correlation_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    recorded_at DATETIME(3) NOT NULL,
    outbound_kind VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    destination TEXT NOT NULL,
    http_method VARCHAR(16),
    origin_incomplete TINYINT(1) NOT NULL,
    origin_headers_json LONGTEXT,
    origin_body LONGBLOB,
    origin_truncated TINYINT(1) NOT NULL,
    origin_sha256 VARCHAR(64),
    outbound_headers_json LONGTEXT,
    outbound_body LONGBLOB,
    outbound_truncated TINYINT(1) NOT NULL,
    outbound_sha256 VARCHAR(64),
    ssh_command TEXT,
    skill_context VARCHAR(256),
    skill_id BIGINT,
    proxy_request_json LONGTEXT,
    outbound_response_status INT,
    outbound_response_headers_json LONGTEXT,
    outbound_response_body LONGBLOB,
    outbound_response_truncated TINYINT(1) NOT NULL,
    outbound_response_sha256 VARCHAR(64),
    INDEX idx_gw_out_audit_corr (correlation_id),
    INDEX idx_gw_out_audit_user_time (user_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS llm_http_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128),
    session_id VARCHAR(128),
    correlation_id VARCHAR(64) NOT NULL,
    direction VARCHAR(32) NOT NULL,
    recorded_at DATETIME(3) NOT NULL,
    payload_json LONGTEXT NOT NULL,
    INDEX idx_llm_http_audit_user_recorded (user_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skill_ssh_invocation_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    correlation_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    skill_id BIGINT,
    recorded_at DATETIME(3) NOT NULL,
    skill_context VARCHAR(256),
    agent_request_json LONGTEXT,
    resolved_host TEXT,
    resolved_port INT,
    executed_command TEXT,
    server_ledger_id BIGINT,
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    result_body LONGTEXT,
    result_truncated TINYINT(1) NOT NULL,
    INDEX idx_ssh_inv_audit_user_time (user_id, recorded_at),
    INDEX idx_ssh_inv_audit_skill (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    notified_at DATETIME DEFAULT NULL COMMENT '用户已读时间；NULL 表示尚未读',
    poll_strategy VARCHAR(20) DEFAULT 'PERIODIC' COMMENT 'PERIODIC=周期轮询；SINGLE_CALL=单次长调用',
    single_call_read_timeout_seconds INT DEFAULT NULL COMMENT 'SINGLE_CALL 专用 read timeout（秒）；NULL 回退 maxWaitSeconds',
    request_signature VARCHAR(64) DEFAULT NULL COMMENT '请求签名 SHA-256 hex（去重用）',
    request_body MEDIUMTEXT DEFAULT NULL COMMENT 'SINGLE_CALL 模式的原始请求体（JSON 字符串）；PERIODIC 模式为 NULL',
    INDEX idx_async_status (status),
    INDEX idx_async_skill_id (skill_id),
    INDEX idx_async_user_unread (user_id, status, notified_at),
    INDEX idx_async_user_session_sig_time (user_id, session_id, request_signature, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skill_text_prompts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    field_id VARCHAR(64) NOT NULL UNIQUE,
    field_label VARCHAR(128),
    system_prompt TEXT,
    user_prompt_template TEXT,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- conversation_logs（对话日志表 - 记录完整的对话信息，便于问题排查和日志分析）
CREATE TABLE IF NOT EXISTS conversation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL COMMENT '用户 ID',
    session_id VARCHAR(64) NOT NULL COMMENT '会话 ID',
    trace_id VARCHAR(64) COMMENT '追踪 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '对话创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '对话更新时间',
    response_duration_seconds DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '响应时长（秒）',
    llm_rounds INT NOT NULL DEFAULT 0 COMMENT 'LLM 响应执行轮数',
    tool_call_rounds INT NOT NULL DEFAULT 0 COMMENT '工具调用轮数',
    is_exceed_max_round TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否超出最大轮',
    is_success TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功执行',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态',
    finish_reason VARCHAR(128) COMMENT '结束原因',
    llm_model VARCHAR(128) COMMENT '使用的 LLM 模型',
    skill_name VARCHAR(128) COMMENT '调用的技能名称',
    tool_name VARCHAR(128) COMMENT '调用的工具名称',
    log_level VARCHAR(32) COMMENT '日志级别',
    log_message TEXT COMMENT '日志消息内容',
    error_message TEXT COMMENT '错误信息',
    error_stack_trace LONGTEXT COMMENT '错误堆栈信息',
    request_data LONGTEXT COMMENT '请求数据 (JSON 格式)',
    response_data LONGTEXT COMMENT '响应数据 (JSON 格式)',
    conversation_content LONGTEXT COMMENT '对话内容 (JSON 格式)',
    total_tokens INT COMMENT '消耗的 token 总数',
    prompt_tokens INT COMMENT '提示词 token 数',
    completion_tokens INT COMMENT '补全 token 数',
    agent_version VARCHAR(32) COMMENT '代理版本',
    environment VARCHAR(32) COMMENT '环境',
    INDEX idx_conv_user_id (user_id),
    INDEX idx_conv_session_id (session_id),
    INDEX idx_conv_trace_id (trace_id),
    INDEX idx_conv_created_at (created_at),
    INDEX idx_conv_status (status),
    INDEX idx_conv_is_success (is_success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话日志表';

-- tool_call_logs（工具调用日志表 - 记录详细的工具调用信息，便于问题排查和性能分析）
CREATE TABLE IF NOT EXISTS tool_call_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL COMMENT '追踪 ID（关联 conversation_logs）',
    session_id VARCHAR(64) NOT NULL COMMENT '会话 ID',
    user_id VARCHAR(64) COMMENT '用户 ID',
    tool_name VARCHAR(128) NOT NULL COMMENT '工具名称',
    skill_name VARCHAR(128) COMMENT '技能名称',
    tool_call_id VARCHAR(64) COMMENT '工具调用 ID',
    request_params LONGTEXT COMMENT '请求参数 (JSON 格式)',
    response_result LONGTEXT COMMENT '响应结果 (JSON 格式)',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '调用状态: PENDING/RUNNING/SUCCESS/FAILED/TIMEOUT',
    error_message TEXT COMMENT '错误信息',
    start_time DATETIME NOT NULL COMMENT '调用开始时间',
    end_time DATETIME COMMENT '调用结束时间',
    duration_ms INT COMMENT '耗时（毫秒）',
    llm_input_tokens INT COMMENT 'LLM 输入 token 数',
    llm_output_tokens INT COMMENT 'LLM 输出 token 数',
    http_status INT COMMENT 'HTTP 状态码',
    gateway_url VARCHAR(512) COMMENT '网关 URL',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    INDEX idx_tool_trace_id (trace_id),
    INDEX idx_tool_session_id (session_id),
    INDEX idx_tool_user_id (user_id),
    INDEX idx_tool_tool_name (tool_name),
    INDEX idx_tool_status (status),
    INDEX idx_tool_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工具调用日志表';
