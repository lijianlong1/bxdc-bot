# 变更总结 - 对话日志和工具调用日志功能

## 变更概述

本次变更新增了完整的日志记录功能，包括对话日志和工具调用日志，解决了日志查找困难、定位不准确的问题。支持无感加表，无需手动操作数据库。

## 变更时间

- 创建时间：2026-05-29
- 完成时间：2026-05-29
- 归档时间：2026-05-29

## 主要变更内容

### 1. 数据库变更

#### 新增表

**conversation_logs（对话日志表）**
- 记录每次对话的完整信息
- 包含用户ID、会话ID、响应时长、LLM轮数、工具调用轮数等
- 支持按用户、会话、时间等维度查询

**tool_call_logs（工具调用日志表）**
- 记录每个工具调用的详细信息
- 包含请求参数、响应结果、耗时、状态等
- 支持追踪关键运行路程和接口调用节点

#### 数据库文件

- `backend/skill-gateway/src/main/resources/schema-mysql.sql` - 表定义
- `docs/deploy-ddl/005-conversation-logs.sql` - 迁移脚本
- `docs/deploy-ddl/005-conversation-logs-migration.md` - 迁移说明
- `docs/deploy-ddl/005-conversation-logs-internal-deployment.md` - 内网部署指南

### 2. Skill-Gateway 后端变更

#### 新增文件

**实体类**
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/ConversationLog.java`
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/ToolCallLog.java`

**Mapper 接口**
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/ConversationLogMapper.java`
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/ToolCallLogMapper.java`

**Service 层**
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/ConversationLogService.java`
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/ToolCallLogService.java`

**Controller 层**
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/ConversationLogController.java`
- `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/ToolCallLogController.java`

#### 新增 API 接口

**对话日志接口**
- `POST /api/internal/conversation-logs` - 新增日志
- `GET /api/internal/conversation-logs/{id}` - 根据ID查询
- `GET /api/internal/conversation-logs/user/{userId}` - 根据用户ID查询
- `GET /api/internal/conversation-logs/session/{sessionId}` - 根据会话ID查询
- `GET /api/internal/conversation-logs/failed` - 查询失败日志
- `GET /api/internal/conversation-logs/status/{status}` - 根据状态查询
- `GET /api/internal/conversation-logs/page` - 分页查询
- `GET /api/internal/conversation-logs/time-range` - 时间范围查询
- `GET /api/internal/conversation-logs/slow` - 查询慢响应
- `POST /api/internal/conversation-logs/cleanup` - 清理历史数据

**工具调用日志接口**
- `POST /api/internal/tool-call-logs` - 新增日志
- `GET /api/internal/tool-call-logs/{id}` - 根据ID查询
- `GET /api/internal/tool-call-logs/trace/{traceId}` - 根据追踪ID查询
- `GET /api/internal/tool-call-logs/session/{sessionId}` - 根据会话ID查询
- `GET /api/internal/tool-call-logs/failed` - 查询失败日志
- `GET /api/internal/tool-call-logs/page` - 分页查询
- `GET /api/internal/tool-call-logs/tool/{toolName}` - 根据工具名称查询

### 3. Agent-Core 变更

#### 修改文件

**日志记录服务**
- `backend/agent-core/src/utils/conversation-logger.ts`
  - 新增 `ToolCallLog` 接口
  - 新增 `logToolCall()` 方法
  - 支持异步日志记录

**核心控制器**
- `backend/agent-core/src/controller/agent.controller.ts`
  - 修改 `emitToolEvent()` 方法，添加工具调用日志记录
  - 修改 `emitToolEvents()` 方法，传递日志记录参数
  - 新增 `toolCallStartTimes` Map，跟踪工具调用开始时间
  - 记录工具调用的请求参数、响应结果、耗时、状态等

#### 新增功能

- 对话结束后自动记录日志到数据库
- 工具调用开始和结束时自动记录详细信息
- 计算并记录响应时长
- 记录 LLM 轮数、工具调用轮数
- 记录请求/响应数据和日志消息

### 4. Frontend 变更

#### 修改文件

**会话管理**
- `frontend/src/composables/useChat.ts`
  - 添加会话ID生成与复用机制
  - 确保同一对话窗口使用相同 sessionId

### 5. Bug 修复

#### 修复的问题

1. **TypeScript 异步错误**
   - 问题：`await expressions are only allowed within async functions`
   - 修复：将 `.catch((error) => {` 修改为 `.catch(async (error) => {`

2. **数据库表未自动创建**
   - 问题：配置文件指定的 SQL 脚本为 `schema-mysql.sql`，而非 `schema.sql`
   - 修复：在 `schema-mysql.sql` 中添加表定义

3. **sessionId 在同一对话窗口变化**
   - 问题：前端每次发送消息创建新 task，导致 sessionId 变化
   - 修复：前端添加会话ID生成与复用机制

4. **工具调用未记录工具名称**
   - 问题：日志记录逻辑中未收集工具调用信息
   - 修复：在 agent.controller.ts 中添加工具调用跟踪逻辑

5. **SSE 400 错误**
   - 问题：`[skill] SSE error event: 400 invalid params, chat content has invalid message role: system (2013)`
   - 修复：将 system prompt 嵌入到 user 消息中，不再使用单独的 `system` 角色

6. **关键运行路程未记录**
   - 问题：原有日志系统仅记录对话级信息，缺少工具调用详细日志
   - 修复：新增 `tool_call_logs` 表，记录工具调用的详细信息

## 技术亮点

### 1. 无感加表
- 通过配置 `spring.sql.init.mode=always` 实现自动建表
- 使用 `IF NOT EXISTS` 确保幂等性
- 无需手动操作数据库

### 2. 完整的追踪链路
- 使用 `trace_id` 关联对话日志和工具调用日志
- 支持从对话到工具调用的完整追踪

### 3. 异步日志记录
- 使用 Promise 异步记录日志，不影响主流程性能
- 错误处理完善，日志记录失败不影响业务

### 4. 详细的性能指标
- 记录响应时长（秒级精度）
- 记录工具调用耗时（毫秒级精度）
- 支持 LLM token 统计

### 5. 灵活的查询接口
- 支持多维度查询（用户、会话、状态、时间范围等）
- 支持分页查询
- 支持慢查询和失败查询

## 部署说明

### 部署方式

1. **自动建表（推荐）**
   - 无需手动操作数据库
   - Spring Boot 启动时自动执行 `schema-mysql.sql`

2. **手动执行 SQL**
   - 适用于需要手动控制的场景
   - 提供 SQL 脚本和执行命令

### 部署步骤

1. 更新代码
2. 部署 skill-gateway（自动创建表）
3. 部署 agent-core
4. 验证功能

详细部署步骤请参考：`docs/deploy-ddl/005-conversation-logs-internal-deployment.md`

## 测试验证

### 功能测试

- [x] 测试日志记录功能
- [x] 测试查询接口
- [x] 验证响应时长计算准确
- [x] 验证 sessionId 复用
- [x] 验证工具调用日志记录
- [x] 验证 SSE 错误修复

### 性能测试

- [x] 日志记录不影响主流程性能
- [x] 数据库查询性能良好（已创建索引）

## 影响范围

### 代码库影响

- 新增文件：15+ 个
- 修改文件：5 个
- 新增表：2 个
- 新增接口：18+ 个

### 依赖影响

- 无新增依赖
- 使用现有技术栈（MyBatis-Plus、Spring Boot、NestJS）

### 系统影响

- 对话结束后写入日志，性能影响可忽略
- 数据库存储增加，建议定期清理历史数据

## 后续优化建议

1. **数据清理**
   - 实现定时任务自动清理历史数据
   - 支持配置保留天数

2. **性能优化**
   - 大数据量场景使用分区表
   - 考虑使用 Elasticsearch 提升查询性能

3. **监控告警**
   - 配置日志监控指标
   - 设置失败率和慢响应告警

4. **数据脱敏**
   - 对敏感信息进行脱敏处理
   - 支持配置脱敏规则

## 相关文档

- [迁移说明](./005-conversation-logs-migration.md)
- [内网部署指南](./005-conversation-logs-internal-deployment.md)
- [OpenSpec 变更记录](../../openspec/changes/archive/2026-05-29-add-conversation-log-table/)

## 变更记录

| 时间 | 变更内容 | 负责人 |
|------|----------|--------|
| 2026-05-29 | 创建变更提案 | - |
| 2026-05-29 | 完成设计和任务分解 | - |
| 2026-05-29 | 完成开发实现 | - |
| 2026-05-29 | 修复 Bug 并测试验证 | - |
| 2026-05-29 | 归档变更 | - |