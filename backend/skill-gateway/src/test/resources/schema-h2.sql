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
    description TEXT,
    type VARCHAR(255) NOT NULL,
    configuration TEXT,
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
    params TEXT,
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
    description TEXT,
    kind VARCHAR(32) NOT NULL,
    configuration TEXT,
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
    error_message TEXT,
    destination TEXT NOT NULL,
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
    ssh_command TEXT,
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
    resolved_host TEXT,
    resolved_port INT,
    executed_command TEXT,
    server_ledger_id BIGINT,
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    result_body CLOB,
    result_truncated BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ssh_inv_audit_user_time ON skill_ssh_invocation_audit_logs(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ssh_inv_audit_skill ON skill_ssh_invocation_audit_logs(skill_id);
