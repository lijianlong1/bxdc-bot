# 内网部署指南 - 对话日志和工具调用日志功能

## 功能概述

本次更新新增了完整的日志记录功能，包括：
- **对话日志表** (`conversation_logs`)：记录每次对话的完整信息
- **工具调用日志表** (`tool_call_logs`)：记录每个工具调用的详细信息

## 部署前准备

### 1. 环境要求

- MySQL 5.7+
- Java 8+
- Node.js 16+
- Maven 3.6+

### 2. 代码更新

```bash
# 拉取最新代码
git pull origin <branch-name>

# 检查变更文件
git diff HEAD~1
```

## 部署步骤

### 第一步：数据库迁移（无感加表）

**无需手动操作数据库！** 系统会在启动时自动创建表。

确保 `backend/skill-gateway/src/main/resources/application.yml` 配置正确：

```yaml
spring:
  sql:
    init:
      mode: always
      schema-locations: classpath:schema-mysql.sql
```

**验证表创建**：
```sql
-- 检查表是否存在
SHOW TABLES LIKE 'conversation_logs';
SHOW TABLES LIKE 'tool_call_logs';

-- 查看表结构
DESC conversation_logs;
DESC tool_call_logs;
```

### 第二步：部署 Skill-Gateway

```bash
cd backend/skill-gateway

# 编译打包
mvn clean package -DskipTests

# 停止旧服务
systemctl stop skill-gateway

# 备份旧版本
cp skill-gateway.jar skill-gateway.jar.bak

# 部署新版本
cp target/skill-gateway.jar /path/to/deploy/

# 启动新服务
systemctl start skill-gateway

# 查看日志
journalctl -u skill-gateway -f
```

**验证服务启动**：
```bash
# 检查服务状态
systemctl status skill-gateway

# 检查健康检查接口
curl http://localhost:18080/health

# 检查日志接口
curl http://localhost:18080/api/internal/conversation-logs/page?page=1&size=10
```

### 第三步：部署 Agent-Core

```bash
cd backend/agent-core

# 安装依赖
npm install

# 构建生产版本
npm run build

# 停止旧服务
systemctl stop agent-core

# 部署新版本
cp -r dist/* /path/to/deploy/agent-core/

# 启动新服务
systemctl start agent-core

# 查看日志
journalctl -u agent-core -f
```

**验证服务启动**：
```bash
# 检查服务状态
systemctl status agent-core

# 检查健康检查接口
curl http://localhost:3000/health
```

### 第四步：部署 Frontend（可选）

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 部署到 Nginx
cp -r dist/* /path/to/nginx/html/

# 重启 Nginx
systemctl restart nginx
```

## 验证部署

### 1. 功能验证

```bash
# 发起测试对话
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "你好",
    "context": {
      "userId": "test-user-001",
      "sessionId": "test-session-001"
    }
  }'
```

### 2. 数据库验证

```sql
-- 查询对话日志
SELECT 
  id,
  user_id,
  session_id,
  trace_id,
  status,
  response_duration_seconds,
  llm_rounds,
  tool_call_rounds,
  created_at
FROM conversation_logs
ORDER BY created_at DESC
LIMIT 10;

-- 查询工具调用日志
SELECT 
  id,
  trace_id,
  tool_name,
  skill_name,
  status,
  duration_ms,
  start_time,
  end_time
FROM tool_call_logs
ORDER BY created_at DESC
LIMIT 10;

-- 关联查询对话和工具调用
SELECT 
  cl.id AS conversation_id,
  cl.session_id,
  cl.status AS conversation_status,
  cl.response_duration_seconds,
  COUNT(tcl.id) AS tool_call_count,
  SUM(tcl.duration_ms) AS total_tool_duration_ms
FROM conversation_logs cl
LEFT JOIN tool_call_logs tcl ON cl.trace_id = tcl.trace_id
GROUP BY cl.id
ORDER BY cl.created_at DESC
LIMIT 10;
```

### 3. API 接口验证

```bash
# 查询对话日志（分页）
curl "http://localhost:18080/api/internal/conversation-logs/page?page=1&size=10"

# 查询失败日志
curl "http://localhost:18080/api/internal/conversation-logs/failed"

# 查询慢响应（超过 5 秒）
curl "http://localhost:18080/api/internal/conversation-logs/slow?threshold=5"

# 查询工具调用日志（分页）
curl "http://localhost:18080/api/internal/tool-call-logs/page?page=1&size=10"

# 查询失败的工具调用
curl "http://localhost:18080/api/internal/tool-call-logs/failed"
```

## 常见问题排查

### 1. 表未自动创建

**症状**：启动时报错 `Table 'xxx.conversation_logs' doesn't exist`

**解决方案**：
```bash
# 检查配置文件
cat backend/skill-gateway/src/main/resources/application.yml | grep -A 5 "spring.sql.init"

# 手动执行 SQL
mysql -u <username> -p <database> < backend/skill-gateway/src/main/resources/schema-mysql.sql
```

### 2. 日志未写入

**症状**：对话正常，但数据库中没有日志记录

**解决方案**：
```bash
# 检查 agent-core 日志
journalctl -u agent-core -f | grep "ConversationLogger"

# 检查网络连接
curl -X POST http://localhost:18080/api/internal/conversation-logs \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 检查 skill-gateway 日志
journalctl -u skill-gateway -f | grep "conversation-logs"
```

### 3. sessionId 变化

**症状**：同一对话窗口的 sessionId 每次都不同

**解决方案**：
- 确保前端使用 `useChat.ts` 中的会话管理逻辑
- 检查前端是否正确传递 `sessionId`

### 4. SSE 400 错误

**症状**：`[skill] SSE error event: 400 invalid params, chat content has invalid message role: system`

**解决方案**：
- 已修复：system prompt 现在嵌入到 user 消息中
- 确保使用最新版本的 agent-core

## 性能优化建议

### 1. 数据库索引

已创建以下索引，确保查询性能：

```sql
-- conversation_logs 表索引
INDEX idx_user_id (user_id),
INDEX idx_session_id (session_id),
INDEX idx_trace_id (trace_id),
INDEX idx_status (status),
INDEX idx_created_at (created_at),
INDEX idx_response_duration (response_duration_seconds);

-- tool_call_logs 表索引
INDEX idx_tool_trace_id (trace_id),
INDEX idx_tool_session_id (session_id),
INDEX idx_tool_user_id (user_id),
INDEX idx_tool_tool_name (tool_name),
INDEX idx_tool_status (status),
INDEX idx_tool_start_time (start_time);
```

### 2. 数据清理

建议定期清理历史数据：

```bash
# 清理 30 天前的日志
curl -X POST "http://localhost:18080/api/internal/conversation-logs/cleanup?days=30"

# 或使用 SQL
DELETE FROM conversation_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
DELETE FROM tool_call_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### 3. 分区表（大数据量场景）

如果日志量很大，建议使用分区表：

```sql
-- 按月分区
ALTER TABLE conversation_logs PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p202601 VALUES LESS THAN (TO_DAYS('2026-02-01')),
  PARTITION p202602 VALUES LESS THAN (TO_DAYS('2026-03-01')),
  PARTITION p202603 VALUES LESS THAN (TO_DAYS('2026-04-01')),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

## 回滚方案

如果部署出现问题，可以快速回滚：

```bash
# 1. 停止服务
systemctl stop skill-gateway
systemctl stop agent-core

# 2. 恢复旧版本
cd /path/to/deploy
mv skill-gateway.jar skill-gateway.jar.new
mv skill-gateway.jar.bak skill-gateway.jar

# 3. 启动服务
systemctl start skill-gateway
systemctl start agent-core

# 4. 验证服务
curl http://localhost:18080/health
curl http://localhost:3000/health
```

## 监控告警

建议配置以下监控指标：

1. **对话成功率**：`is_success = 1` 的比例
2. **平均响应时长**：`AVG(response_duration_seconds)`
3. **失败对话数**：`status = 'FAILED'` 的数量
4. **工具调用成功率**：`tool_call_logs.status = 'SUCCESS'` 的比例
5. **慢查询数**：`response_duration_seconds > 5` 的数量

## 联系方式

如有问题，请联系：
- 技术支持：[技术支持邮箱]
- 文档地址：[文档地址]
- 问题反馈：[问题反馈地址]