## 1. 数据库迁移

- [x] 1.1 创建数据库迁移脚本 `docs/deploy-ddl/005-conversation-logs.sql`
- [x] 1.2 在 skill-gateway 的 `src/main/resources/schema-mysql.sql` 中添加 `conversation_logs` 表定义
- [x] 1.3 在 skill-gateway 的 `src/main/resources/schema-mysql.sql` 中添加 `tool_call_logs` 表定义

## 2. Skill-Gateway 后端实现

### 2.1 对话日志模块
- [x] 2.1.1 创建实体类 `ConversationLog.java`
- [x] 2.1.2 创建 Mapper 接口 `ConversationLogMapper.java`
- [x] 2.1.3 创建 Service 类 `ConversationLogService.java`
- [x] 2.1.4 创建 Controller 类 `ConversationLogController.java`

### 2.2 工具调用日志模块
- [x] 2.2.1 创建实体类 `ToolCallLog.java`
- [x] 2.2.2 创建 Mapper 接口 `ToolCallLogMapper.java`
- [x] 2.2.3 创建 Service 类 `ToolCallLogService.java`
- [x] 2.2.4 创建 Controller 类 `ToolCallLogController.java`

## 3. Agent-Core 集成

### 3.1 对话日志集成
- [x] 3.1.1 在 agent-core 中添加日志记录服务 `conversation-logger.ts`
- [x] 3.1.2 在对话执行完成后调用日志记录
- [x] 3.1.3 计算响应时长并记录
- [x] 3.1.4 记录 LLM 轮数、工具调用轮数等信息
- [x] 3.1.5 记录请求/响应数据和日志消息

### 3.2 工具调用日志集成
- [x] 3.2.1 在 `conversation-logger.ts` 中新增 `ToolCallLog` 接口
- [x] 3.2.2 在 `conversation-logger.ts` 中新增 `logToolCall()` 方法
- [x] 3.2.3 修改 `agent.controller.ts` 的 `emitToolEvent()` 方法，添加工具调用开始/结束追踪
- [x] 3.2.4 修改 `agent.controller.ts` 的 `emitToolEvents()` 方法，传递日志记录参数
- [x] 3.2.5 添加 `toolCallStartTimes` Map 跟踪工具调用开始时间
- [x] 3.2.6 修复 `isAssistantMessage()` 函数，支持 `kind=ai` 类型消息

## 4. 部署迁移

- [x] 4.1 编写部署迁移说明文档
- [x] 4.2 提供 SQL 执行命令示例

## 5. 验证测试

- [x] 5.1 测试日志记录功能
- [x] 5.2 测试查询接口
- [x] 5.3 验证响应时长计算准确

## 6. Bug 修复

- [x] 6.1 修复 TypeScript 异步错误（await expressions）
- [x] 6.2 修复数据库表未自动创建问题（配置 schema-mysql.sql）
- [x] 6.3 修复 sessionId 在同一对话窗口变化的问题（前端会话复用机制）
- [x] 6.4 修复工具调用未记录工具名称的问题
- [x] 6.5 修复 SSE 400 错误（invalid message role: system）
- [x] 6.6 新增工具调用日志表 `tool_call_logs`，记录关键运行路程和接口调用节点
- [x] 6.7 修复 `isAssistantMessage()` 函数，支持 langgraph 返回的 `kind=ai` 类型消息，确保工具调用日志正确记录