CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(6) PRIMARY KEY,
    nickname VARCHAR(255),
    avatar VARCHAR(255),
    created_at TIMESTAMP,
    llm_api_base VARCHAR(512),
    llm_model_name VARCHAR(128),
    llm_api_key VARCHAR(2048)
);

CREATE TABLE IF NOT EXISTS skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description CLOB,
    type VARCHAR(255) NOT NULL,
    configuration CLOB,
    execution_mode VARCHAR(255) DEFAULT 'CONFIG',
    enabled BOOLEAN DEFAULT TRUE,
    requires_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    visibility VARCHAR(16) NOT NULL DEFAULT 'PUBLIC',
    avatar VARCHAR(32),
    created_by VARCHAR(128),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(255),
    skill_name VARCHAR(255),
    command_or_url VARCHAR(255),
    params CLOB,
    status VARCHAR(255),
    timestamp TIMESTAMP
);

CREATE TABLE IF NOT EXISTS server_ledgers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255),
    port INT,
    username VARCHAR(255),
    password VARCHAR(255),
    private_key_path VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE KEY uk_server_ledgers_user_name (user_id, name),
    UNIQUE KEY uk_server_ledgers_user_host (user_id, host)
);

CREATE TABLE IF NOT EXISTS system_skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tool_name VARCHAR(128) NOT NULL UNIQUE,
    description CLOB,
    kind VARCHAR(32) NOT NULL,
    configuration CLOB,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    schema_version INT DEFAULT 1,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gateway_outbound_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    correlation_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    recorded_at TIMESTAMP NOT NULL,
    outbound_kind VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_message CLOB,
    destination CLOB NOT NULL,
    http_method VARCHAR(16),
    origin_incomplete BOOLEAN NOT NULL,
    origin_headers_json CLOB,
    origin_body BLOB,
    origin_truncated BOOLEAN NOT NULL,
    origin_sha256 VARCHAR(64),
    outbound_headers_json CLOB,
    outbound_body BLOB,
    outbound_truncated BOOLEAN NOT NULL,
    outbound_sha256 VARCHAR(64),
    ssh_command CLOB,
    skill_context VARCHAR(256),
    skill_id BIGINT,
    proxy_request_json CLOB,
    outbound_response_status INT,
    outbound_response_headers_json CLOB,
    outbound_response_body BLOB,
    outbound_response_truncated BOOLEAN NOT NULL,
    outbound_response_sha256 VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_gw_out_audit_corr ON gateway_outbound_audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_gw_out_audit_user_time ON gateway_outbound_audit_logs(user_id, recorded_at);

CREATE TABLE IF NOT EXISTS llm_http_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128),
    session_id VARCHAR(128),
    correlation_id VARCHAR(64) NOT NULL,
    direction VARCHAR(32) NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    payload_json CLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_http_audit_user_recorded ON llm_http_audit_logs(user_id, recorded_at);

CREATE TABLE IF NOT EXISTS skill_ssh_invocation_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    correlation_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    skill_id BIGINT,
    recorded_at TIMESTAMP NOT NULL,
    skill_context VARCHAR(256),
    agent_request_json CLOB,
    resolved_host CLOB,
    resolved_port INT,
    executed_command CLOB,
    server_ledger_id BIGINT,
    status VARCHAR(32) NOT NULL,
    error_message CLOB,
    result_body CLOB,
    result_truncated BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ssh_inv_audit_user_time ON skill_ssh_invocation_audit_logs(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ssh_inv_audit_skill ON skill_ssh_invocation_audit_logs(skill_id);

CREATE TABLE IF NOT EXISTS async_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    skill_id BIGINT,
    user_id VARCHAR(64),
    session_id VARCHAR(64),
    external_task_id VARCHAR(255),
    poll_endpoint VARCHAR(1024),
    poll_method VARCHAR(16) DEFAULT 'GET',
    poll_interval_seconds INT DEFAULT 5,
    max_wait_seconds INT,
    completion_json_path VARCHAR(255),
    completion_value VARCHAR(64),
    failed_values CLOB,
    result_json_path VARCHAR(255),
    poll_headers CLOB,
    initial_response CLOB,
    poll_result CLOB,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    error_message CLOB,
    poll_retry_count INT DEFAULT 0,
    last_polled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    notified_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_async_status ON async_tasks(status);
CREATE INDEX IF NOT EXISTS idx_async_skill_id ON async_tasks(skill_id);
CREATE INDEX IF NOT EXISTS idx_async_user_unread ON async_tasks(user_id, status, notified_at);

CREATE TABLE IF NOT EXISTS skill_text_prompts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    field_id VARCHAR(64) NOT NULL UNIQUE,
    field_label VARCHAR(128),
    system_prompt CLOB,
    user_prompt_template CLOB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    trace_id VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_duration_seconds DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    llm_rounds INT NOT NULL DEFAULT 0,
    tool_call_rounds INT NOT NULL DEFAULT 0,
    is_exceed_max_round BOOLEAN NOT NULL DEFAULT FALSE,
    is_success BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    finish_reason VARCHAR(128),
    llm_model VARCHAR(128),
    skill_name VARCHAR(128),
    tool_name VARCHAR(128),
    log_level VARCHAR(32),
    log_message CLOB,
    error_message CLOB,
    error_stack_trace CLOB,
    request_data CLOB,
    response_data CLOB,
    conversation_content CLOB,
    total_tokens INT,
    prompt_tokens INT,
    completion_tokens INT,
    agent_version VARCHAR(32),
    environment VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_conv_user_id ON conversation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_session_id ON conversation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_conv_trace_id ON conversation_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_conv_created_at ON conversation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_conv_status ON conversation_logs(status);
CREATE INDEX IF NOT EXISTS idx_conv_is_success ON conversation_logs(is_success);

CREATE TABLE IF NOT EXISTS tool_call_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    tool_name VARCHAR(128) NOT NULL,
    skill_name VARCHAR(128),
    tool_call_id VARCHAR(64),
    request_params CLOB,
    response_result CLOB,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    error_message CLOB,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms INT,
    llm_input_tokens INT,
    llm_output_tokens INT,
    http_status INT,
    gateway_url VARCHAR(512),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_trace_id ON tool_call_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_tool_session_id ON tool_call_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_user_id ON tool_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_tool_name ON tool_call_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_status ON tool_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_tool_start_time ON tool_call_logs(start_time);

CREATE TABLE IF NOT EXISTS async_polling_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    async_task_id BIGINT,
    skill_id BIGINT,
    user_id VARCHAR(64),
    session_id VARCHAR(64),
    phase VARCHAR(32),
    recorded_at TIMESTAMP,
    duration_ms INT,
    http_method VARCHAR(16),
    http_url VARCHAR(1024),
    http_status_code INT,
    request_headers_json CLOB,
    request_body CLOB,
    response_headers_json CLOB,
    response_body CLOB,
    error_message CLOB
);

-- 初始化内置 Skills
INSERT INTO system_skills (tool_name, description, kind, configuration, enabled, schema_version)
VALUES
  ('api_caller', 'Calls an external API via the Java gateway (url, method, headers, body).', 'API_PROXY', NULL, TRUE, 1),
  ('compute', 'Math and date operations via Skill Gateway (operation, operands).', 'COMPUTE', NULL, TRUE, 1),
  ('ssh_executor', 'Executes a shell command on a remote server via SSH (host, port, username, command, privateKey or password).', 'SSH_EXECUTOR', NULL, TRUE, 1);
