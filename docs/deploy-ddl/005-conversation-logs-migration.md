# 对话日志和工具调用日志表迁移说明

## 概述

本迁移脚本用于创建 `conversation_logs` 和 `tool_call_logs` 两张表，用于记录完整的对话信息和工具调用详情，便于问题排查和日志分析。

## 数据表结构

### conversation_logs（对话日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | BIGINT | 主键，自增 |
| `user_id` | VARCHAR(64) | 用户ID |
| `session_id` | VARCHAR(64) | 会话ID |
| `trace_id` | VARCHAR(64) | 追踪ID |
| `created_at` | DATETIME | 对话创建时间 |
| `updated_at` | DATETIME | 对话更新时间 |
| `response_duration_seconds` | DECIMAL(10,2) | 响应时长（秒） |
| `llm_rounds` | INT | LLM响应执行轮数 |
| `tool_call_rounds` | INT | 工具调用轮数 |
| `is_exceed_max_round` | TINYINT(1) | 是否超出最大轮 |
| `is_success` | TINYINT(1) | 是否成功执行 |
| `status` | VARCHAR(32) | 状态 |
| `finish_reason` | VARCHAR(128) | 结束原因 |
| `llm_model` | VARCHAR(128) | 使用的LLM模型 |
| `skill_name` | VARCHAR(128) | 调用的技能名称 |
| `tool_name` | VARCHAR(128) | 调用的工具名称 |
| `log_level` | VARCHAR(32) | 日志级别 |
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
| `environment` | VARCHAR(32) | 环境 |

### tool_call_logs（工具调用日志表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | BIGINT | 主键，自增 |
| `trace_id` | VARCHAR(64) | 追踪ID（关联 conversation_logs） |
| `session_id` | VARCHAR(64) | 会话ID |
| `user_id` | VARCHAR(64) | 用户ID |
| `tool_name` | VARCHAR(128) | 工具名称 |
| `skill_name` | VARCHAR(128) | 技能名称 |
| `tool_call_id` | VARCHAR(64) | 工具调用ID |
| `request_params` | LONGTEXT | 请求参数 (JSON 格式) |
| `response_result` | LONGTEXT | 响应结果 (JSON 格式) |
| `status` | VARCHAR(32) | 调用状态: PENDING/RUNNING/SUCCESS/FAILED/TIMEOUT |
| `error_message` | TEXT | 错误信息 |
| `start_time` | DATETIME | 调用开始时间 |
| `end_time` | DATETIME | 调用结束时间 |
| `duration_ms` | INT | 耗时（毫秒） |
| `llm_input_tokens` | INT | LLM 输入 token 数 |
| `llm_output_tokens` | INT | LLM 输出 token 数 |
| `http_status` | INT | HTTP 状态码 |
| `gateway_url` | VARCHAR(512) | 网关 URL |
| `created_at` | DATETIME | 记录创建时间 |

## 迁移方式

### 方式一：自动建表（推荐 - 无感加表）

**无需手动操作数据库！** Spring Boot 启动时会自动执行 `schema.sql`。

确保 `application.yml` 配置正确：

```yaml
spring:
  sql:
    init:
      mode: always
      schema-locations: classpath:schema.sql
```

**原理**：脚本使用 `IF NOT EXISTS` 判断表是否存在，不存在则自动创建。

### 方式二：手动执行 SQL

```bash
# 连接到数据库
mysql -u <用户名> -p -h <数据库地址> <数据库名>

# 执行迁移脚本
source docs/deploy-ddl/005-conversation-logs.sql

# 或者直接执行
mysql -u <用户名> -p -h <数据库地址> <数据库名> < docs/deploy-ddl/005-conversation-logs.sql
```

### 方式三：Flyway 自动迁移

1. 添加 Flyway 依赖到 `pom.xml`：

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

2. 配置 `application.yml`：

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
```

3. 将 SQL 文件重命名为 `V1__conversation-logs.sql` 放入 `src/main/resources/db/migration/`

## API 接口

### 新增日志

```
POST /api/internal/conversation-logs
```

### 查询日志

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/internal/conversation-logs/{id}` | GET | 根据ID查询 |
| `/api/internal/conversation-logs/user/{userId}` | GET | 根据用户ID查询 |
| `/api/internal/conversation-logs/session/{sessionId}` | GET | 根据会话ID查询 |
| `/api/internal/conversation-logs/failed` | GET | 查询失败日志 |
| `/api/internal/conversation-logs/status/{status}` | GET | 根据状态查询 |
| `/api/internal/conversation-logs/page` | GET | 分页查询 |
| `/api/internal/conversation-logs/time-range` | GET | 时间范围查询 |
| `/api/internal/conversation-logs/slow` | GET | 查询慢响应 |

## 注意事项

1. **数据脱敏**：`conversation_content`、`request_data`、`response_data` 可能包含敏感信息，建议存储前进行脱敏处理。

2. **数据清理**：建议定期清理历史数据，可使用 `/api/internal/conversation-logs/cleanup` 接口。

3. **索引优化**：已创建必要索引，确保查询性能。

4. **性能影响**：对话结束后写入日志，对主流程性能影响可忽略。

## 回滚方案

如需回滚，执行以下 SQL：

```sql
DROP TABLE IF EXISTS conversation_logs;
```