## Context

当前对话问答过程中的日志信息分散存储，难以查找和定位问题。用户反馈：
- 找报错信息困难，定位不准确
- 异步对话内容难以追踪
- 无法快速了解对话执行情况（如轮数、是否成功）

## Goals / Non-Goals

**Goals:**
- 设计 `conversation_logs` 数据表结构
- 记录完整的对话信息，便于问题排查
- 支持按用户、会话、时间等维度查询
- 提供数据库迁移脚本

**Non-Goals:**
- 不实现日志清理机制（后续可扩展）
- 不实现实时日志查询 UI（后续可扩展）

## Decisions

### 1. 数据表结构设计
**Decision**：创建 `conversation_logs` 表，包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | BIGINT | 主键，自增 |
| `user_id` | VARCHAR(64) | 用户ID |
| `session_id` | VARCHAR(64) | 会话ID |
| `trace_id` | VARCHAR(64) | 追踪ID（用于分布式追踪） |
| `created_at` | DATETIME | 对话创建时间 |
| `updated_at` | DATETIME | 对话更新时间 |
| `response_duration_seconds` | DECIMAL(10,2) | 响应时长（秒） |
| `llm_rounds` | INT | LLM响应执行轮数 |
| `tool_call_rounds` | INT | 工具调用轮数 |
| `is_exceed_max_round` | TINYINT(1) | 是否超出最大轮（1=是，0=否） |
| `is_success` | TINYINT(1) | 是否成功执行（1=成功，0=失败） |
| `status` | VARCHAR(32) | 状态(PENDING/RUNNING/COMPLETED/FAILED) |
| `finish_reason` | VARCHAR(128) | 结束原因 |
| `llm_model` | VARCHAR(128) | 使用的LLM模型 |
| `skill_name` | VARCHAR(128) | 调用的技能名称 |
| `tool_name` | VARCHAR(128) | 调用的工具名称 |
| `log_level` | VARCHAR(32) | 日志级别(DEBUG/INFO/WARN/ERROR) |
| `log_message` | TEXT | 日志消息内容 |
| `error_message` | TEXT | 错误信息 |
| `error_stack_trace` | LONGTEXT | 错误堆栈信息 |
| `request_data` | LONGTEXT | 请求数据(JSON格式) |
| `response_data` | LONGTEXT | 响应数据(JSON格式) |
| `conversation_content` | LONGTEXT | 对话内容(JSON格式) |
| `total_tokens` | INT | 消耗的token总数 |
| `prompt_tokens` | INT | 提示词token数 |
| `completion_tokens` | INT | 补全token数 |
| `agent_version` | VARCHAR(32) | 代理版本 |
| `environment` | VARCHAR(32) | 环境(development/test/production) |

**Rationale**：涵盖用户需求的所有关键字段，支持灵活查询和问题定位，包含完整的日志输出内容。

### 2. 索引设计
**Decision**：创建以下索引：
- `idx_user_id`：按用户ID索引
- `idx_session_id`：按会话ID索引
- `idx_trace_id`：按追踪ID索引
- `idx_created_at`：按创建时间索引
- `idx_status`：按状态索引
- `idx_is_success`：按是否成功索引

**Rationale**：提升查询性能，支持快速定位问题。

### 3. 数据写入时机
**Decision**：在对话执行完成后（无论是成功还是失败）写入日志。

**Rationale**：确保每条对话都有完整的日志记录。

## Risks / Trade-offs

- **[Risk]**：数据表可能增长较快
  - **Mitigation**：建议定期清理历史数据或分表存储
- **[Risk]**：对话内容可能包含敏感信息
  - **Mitigation**：存储前进行脱敏处理

## Migration Plan

1. 创建数据库迁移脚本（DDL）
2. 在 skill-gateway 中创建实体类和数据访问层
3. 在 agent-core 中添加日志记录逻辑
4. 提供查询接口

## SQL DDL

```sql
CREATE TABLE IF NOT EXISTS conversation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    session_id VARCHAR(64) NOT NULL COMMENT '会话ID',
    trace_id VARCHAR(64) COMMENT '追踪ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '对话创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '对话更新时间',
    response_duration_seconds DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '响应时长（秒）',
    llm_rounds INT NOT NULL DEFAULT 0 COMMENT 'LLM响应执行轮数',
    tool_call_rounds INT NOT NULL DEFAULT 0 COMMENT '工具调用轮数',
    is_exceed_max_round TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否超出最大轮',
    is_success TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功执行',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态',
    finish_reason VARCHAR(128) COMMENT '结束原因',
    llm_model VARCHAR(128) COMMENT '使用的LLM模型',
    skill_name VARCHAR(128) COMMENT '调用的技能名称',
    tool_name VARCHAR(128) COMMENT '调用的工具名称',
    log_level VARCHAR(32) COMMENT '日志级别',
    log_message TEXT COMMENT '日志消息内容',
    error_message TEXT COMMENT '错误信息',
    error_stack_trace LONGTEXT COMMENT '错误堆栈信息',
    request_data LONGTEXT COMMENT '请求数据(JSON格式)',
    response_data LONGTEXT COMMENT '响应数据(JSON格式)',
    conversation_content LONGTEXT COMMENT '对话内容(JSON格式)',
    total_tokens INT COMMENT '消耗的token总数',
    prompt_tokens INT COMMENT '提示词token数',
    completion_tokens INT COMMENT '补全token数',
    agent_version VARCHAR(32) COMMENT '代理版本',
    environment VARCHAR(32) COMMENT '环境',
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_trace_id (trace_id),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status),
    INDEX idx_is_success (is_success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话日志表';
```