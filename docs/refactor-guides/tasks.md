## 1. 项目初始化与环境搭建

### 1.1 创建项目仓库

- [ ] 1.1.1 创建 frontend 仓库（或目录）
  ```bash
  npm create vue@latest frontend
  # 选择：TypeScript、Pinia、Router、ESLint
  cd frontend && npm install
  ```
- [ ] 1.1.2 创建 skill-gateway 仓库（或目录）
  ```bash
  spring init --type=maven --java=17 --boot=3.2.0 --dependencies=web,data-jpa,mysql,flyway skill-gateway
  ```
- [ ] 1.1.3 配置 Git 仓库，添加 .gitignore

### 1.2 数据库环境准备

- [ ] 1.2.1 安装 MySQL 8.0（本地开发环境）
- [ ] 1.2.2 创建数据库：`CREATE DATABASE skill_gateway DEFAULT CHARSET=utf8mb4;`
- [ ] 1.2.3 创建数据库用户并授权
- [ ] 1.2.4 测试连接

### 1.3 Skill-gateway 基础搭建

- [ ] 1.3.1 配置 application.yml
  ```yaml
  server:
    port: 8080
  spring:
    datasource:
      url: jdbc:mysql://localhost:3306/skill_gateway?useSSL=false&serverTimezone=Asia/Shanghai
      username: 
      password: 
    jpa:
      hibernate:
        ddl-auto: validate
      show-sql: true
  ```
- [ ] 1.3.2 配置 Flyway 迁移脚本目录 `src/main/resources/db/migration/`
- [ ] 1.3.3 添加依赖（SpringDoc、Lombok、Validation）
- [ ] 1.3.4 创建包结构（controller/service/repository/entity/dto/config）
- [ ] 1.3.5 启动应用，验证数据库连接成功

### 1.4 Frontend 基础搭建

- [ ] 1.4.1 安装 Element Plus
  ```bash
  npm install element-plus @element-plus/icons-vue
  ```
- [ ] 1.4.2 安装 Axios
  ```bash
  npm install axios
  ```
- [ ] 1.4.3 配置 Vite 代理（开发环境）
  ```javascript
  // vite.config.ts
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
  ```
- [ ] 1.4.4 创建基础目录结构（api/components/stores/views/utils）
- [ ] 1.4.5 配置 Vue Router（基础路由）
- [ ] 1.4.6 配置 Pinia Store
- [ ] 1.4.7 启动应用，验证基础页面显示正常

### 1.5 环境联调

- [ ] 1.5.1 创建测试接口 `GET /api/health`，frontend 调用验证
- [ ] 1.5.2 配置 CORS（允许 frontend 访问）
- [ ] 1.5.3 确认前后端通信正常

---

## 2. 数据库设计与初始化

### 2.1 创建 Flyway 迁移脚本

- [ ] 2.1.1 创建 V1__create_conversations_table.sql
- [ ] 2.1.2 创建 V2__create_conversation_messages_table.sql
- [ ] 2.1.3 创建 V3__create_skills_table.sql
- [ ] 2.1.4 创建 V4__create_skill_categories_table.sql
- [ ] 2.1.5 创建 V5__create_skill_invocation_logs_table.sql
- [ ] 2.1.6 创建 V6__create_user_audit_logs_table.sql
- [ ] 2.1.7 创建 V7__add_indexes.sql（添加索引优化）

### 2.2 创建 JPA 实体

- [ ] 2.2.1 创建 Conversation 实体
  - 字段映射、JSON 类型处理
  - 添加 JPA 注解（@Entity、@Id、@Column）
- [ ] 2.2.2 创建 ConversationMessage 实体
- [ ] 2.2.3 创建 Skill 实体
- [ ] 2.2.4 创建 SkillCategory 实体
- [ ] 2.2.5 创建 SkillInvocationLog 实体
- [ ] 2.2.6 创建 UserAuditLog 实体

### 2.3 创建 Repository 层

- [ ] 2.3.1 创建 ConversationRepository（继承 JpaRepository）
- [ ] 2.3.2 创建 ConversationMessageRepository
  - 添加分页查询方法
  - 添加按 conversation_id 查询
- [ ] 2.3.3 创建 SkillRepository
  - 添加按 kind/type 过滤查询
  - 添加按 visibility 和 owner 查询
- [ ] 2.3.4 创建 SkillInvocationLogRepository
- [ ] 2.3.5 创建 UserAuditLogRepository

### 2.4 数据库验证

- [ ] 2.4.1 运行应用，验证 Flyway 自动创建表
- [ ] 2.4.2 使用 Repository 写入测试数据，验证读写正常
- [ ] 2.4.3 验证 JSON 字段存储和读取正常
- [ ] 2.4.4 验证外键约束（conversation_messages → conversations）

---

## 3. 对话管理功能

### 3.1 Backend - 对话 CRUD API

- [ ] 3.1.1 创建 DTO 类
  - CreateConversationRequest/Response
  - ConversationVO（返回给前端的视图对象）
  - MessageVO
- [ ] 3.1.2 实现 ConversationService
  - createConversation：生成 UUID、设置默认配置
  - listConversations：分页查询，按更新时间倒序
  - getConversation：查询详情和最近消息
  - updateConversation：更新标题、启用 Skill
  - deleteConversation：软删除（设置 status=deleted）
- [ ] 3.1.3 实现 ConversationController
  - POST /api/v1/conversations
  - GET /api/v1/conversations（分页参数 page/size）
  - GET /api/v1/conversations/{conversation_id}
  - PUT /api/v1/conversations/{conversation_id}
  - DELETE /api/v1/conversations/{conversation_id}
- [ ] 3.1.4 添加参数校验（@Valid、@NotBlank 等）
- [ ] 3.1.5 使用 SpringDoc 添加 API 文档注解
- [ ] 3.1.6 测试所有 API（使用 Postman 或 curl）

### 3.2 Frontend - 对话列表界面

- [ ] 3.2.1 创建 Conversation 类型定义（src/api/types/conversation.ts）
- [ ] 3.2.2 创建 conversation API 模块（src/api/conversation.ts）
- [ ] 3.2.3 创建 conversation Store（Pinia）
  - 存储对话列表、当前对话
  - 提供 loadConversations、createConversation 等方法
- [ ] 3.2.4 创建左侧边栏组件（ConversationList.vue）
  - 显示对话列表
  - 支持点击切换
  - 显示最后更新时间
- [ ] 3.2.5 创建对话项组件（ConversationItem.vue）
  - 显示标题、摘要、时间
  - 悬停显示操作按钮（删除）
- [ ] 3.2.6 创建新建对话按钮和弹窗
- [ ] 3.2.7 联调测试：能正常创建、显示、切换对话

### 3.3 Frontend - 对话详情界面

- [ ] 3.3.1 创建 ChatView.vue 主页面
  - 左侧边栏 + 右侧聊天区域布局
- [ ] 3.3.2 创建消息列表组件（MessageList.vue）
  - 支持向上滚动加载历史（分页）
- [ ] 3.3.3 创建单条消息组件（MessageItem.vue）
  - 区分 user/assistant/tool 角色样式
- [ ] 3.3.4 创建输入框组件（InputArea.vue）
  - 文本输入、发送按钮
- [ ] 3.3.5 联调测试：能正常查看对话历史、发送消息（先 mock 响应）

---

## 4. Agent-core 代理层

### 4.1 Backend - 代理服务实现

- [ ] 4.1.1 配置 HTTP Client（RestTemplate 或 WebClient）
  - 设置连接池、超时时间
  - 配置 agent-core 地址（application.yml）
- [ ] 4.1.2 创建 AgentProxyService
  - proxyRun 方法：转发请求到 agent-core
  - 处理 SSE 响应流
- [ ] 4.1.3 实现 SSE 流代理
  - 接收 agent-core 的 SSE 事件
  - 转发给前端（保持 SSE 格式）
  - 处理连接断开和异常
- [ ] 4.1.4 创建 AgentProxyController
  - POST /api/v1/conversations/{id}/run
  - 从数据库查询对话配置
  - 组装请求（消息 + 历史 + 可用 Skill）
  - 返回 SseEmitter
- [ ] 4.1.5 添加请求头传递
  - X-Conversation-Id
  - X-User-Id
  - X-Enabled-Skills（JSON 数组）

### 4.2 Frontend - SSE 流处理

- [ ] 4.2.1 创建 SSE 工具模块（src/utils/sse.ts）
  - 封装 EventSource
  - 支持自定义 headers（使用 fetch + ReadableStream）
- [ ] 4.2.2 在 chat Store 中添加 sendMessage 方法
  - 建立 SSE 连接
  - 解析不同事件类型
  - 更新消息列表（流式追加内容）
- [ ] 4.2.3 在 MessageItem 组件中支持流式展示（打字机效果）
- [ ] 4.2.4 处理连接中断和重连
- [ ] 4.2.5 处理错误事件（显示错误提示）

### 4.3 联调测试

- [ ] 4.3.1 确保 agent-core 运行并可访问
- [ ] 4.3.2 从 frontend 发送消息，验证能收到流式响应
- [ ] 4.3.3 验证多轮对话上下文保持
- [ ] 4.3.4 测试连接断开场景（网络抖动）

---

## 5. Skill 管理与执行

### 5.1 Backend - Skill CRUD

- [ ] 5.1.1 创建 Skill DTO
  - CreateSkillRequest
  - SkillVO（返回字段控制，configuration 可能敏感）
- [ ] 5.1.2 实现 SkillService
  - createSkill：生成 skill_id、验证配置
  - listSkills：根据用户权限过滤（自己的+公开的+builtin）
  - getSkill：查询详情
  - updateSkill：更新（仅 owner 可改）
  - deleteSkill：软删除
- [ ] 5.1.3 实现 SkillController
  - POST /api/v1/skills
  - GET /api/v1/skills（支持 keyword/type/category 过滤）
  - GET /api/v1/skills/{skill_id}
  - PUT /api/v1/skills/{skill_id}
  - DELETE /api/v1/skills/{skill_id}
- [ ] 5.1.4 添加 Skill 分类查询接口

### 5.2 Frontend - Skill 界面

- [ ] 5.2.1 创建 Skill 类型定义
- [ ] 5.2.2 创建 skill API 模块
- [ ] 5.2.3 创建 Skill 列表页面
  - 分类筛选、搜索
  - 显示 builtin/extension 标签
- [ ] 5.2.4 创建 Skill 详情弹窗
  - 显示描述、参数说明
  - 显示示例
- [ ] 5.2.5 创建对话内的 Skill 选择器（多选）
  - 在对话设置中配置可用 Skill

### 5.3 Backend - Built-in Skill 执行框架

- [ ] 5.3.1 定义 SkillExecutor 接口
  ```java
  public interface SkillExecutor {
      String getSkillId();
      SkillOutput execute(SkillInput input, ExecutionContext ctx);
  }
  ```
- [ ] 5.3.2 创建 ExecutionContext 类
  - userId、conversationId、messageId 等上下文
- [ ] 5.3.3 创建 SkillExecutionService
  - 管理所有 executor（Map<String, SkillExecutor>）
  - route 方法：根据 skill_id 找到对应 executor
- [ ] 5.3.4 注册机制（Spring Bean 自动注册）

### 5.4 Backend - 实现 api_caller

- [ ] 5.4.1 创建 ApiCallerExecutor 类
- [ ] 5.4.2 实现配置解析（endpoint、method、headers、params）
- [ ] 5.4.3 使用 RestTemplate 执行 HTTP 请求
- [ ] 5.4.4 处理 GET/POST/PUT/DELETE
- [ ] 5.4.5 处理请求头、Query 参数、Body
- [ ] 5.4.6 处理响应（JSON 解析）
- [ ] 5.4.7 添加超时和错误处理
- [ ] 5.4.8 单元测试

### 5.5 Backend - 实现 compute

- [ ] 5.5.1 创建 ComputeExecutor 类
- [ ] 5.5.2 集成表达式引擎（如 JEXL 或 JavaScript 引擎）
- [ ] 5.5.3 支持数学运算、字符串处理
- [ ] 5.5.4 单元测试

### 5.6 Backend - 实现 ssh_executor

- [ ] 5.6.1 创建 SshExecutor 类
- [ ] 5.6.2 集成 SSH 客户端库（JSch 或 Apache MINA）
- [ ] 5.6.3 配置服务器台账（从数据库或配置文件）
- [ ] 5.6.4 实现固化脚本执行（不支持任意命令）
- [ ] 5.6.5 添加危险命令白名单校验
- [ ] 5.6.6 集成确认流（与 confirmation 模块配合）
- [ ] 5.6.7 单元测试（使用 SSH mock）

### 5.7 Backend - Extension Skill 执行

- [ ] 5.7.1 实现 API 类型执行
  - 代理 HTTP 请求
  - 支持配置中的 endpoint、headers
- [ ] 5.7.2 实现 Template 类型执行
  - 渲染模板（使用 Freemarker 或 Thymeleaf）
  - 返回渲染后内容
- [ ] 5.7.3 实现 OPENCLAW 类型执行
  - 解析 orchestration 配置
  - 按顺序调用存量 Skill
  - 汇总结果

### 5.8 Backend - Skill 统一执行接口

- [ ] 5.8.1 创建 POST /api/v1/skills/{skill_id}/execute 接口（内部使用）
- [ ] 5.8.2 创建 ExecutionService，统一入口
  - 查询 Skill
  - 路由到对应 executor
  - 记录调用日志
  - 返回结果

### 5.9 联调测试

- [ ] 5.9.1 在 agent-core 中移除内置实现，改为调用 skill-gateway
- [ ] 5.9.2 测试 api_caller 调用外部 API
- [ ] 5.9.3 测试 compute 计算功能
- [ ] 5.9.4 测试 ssh_executor 执行脚本
- [ ] 5.9.5 测试 Extension Skill 代理

---

## 6. 确认流与日志

### 6.1 Backend - 确认流实现

- [ ] 6.1.1 创建 ConfirmationService
  - generateRequest：生成确认请求 ID
  - waitForResponse：阻塞等待用户确认（使用 CompletableFuture）
  - submitResponse：用户提交确认结果
- [ ] 6.1.2 修改 AgentProxyService
  - 当收到 confirmation_request 事件时，暂停转发
  - 等待用户确认后再继续
- [ ] 6.1.3 创建确认提交接口
  - POST /api/v1/conversations/{id}/confirm
- [ ] 6.1.4 添加超时处理（默认 60 秒）

### 6.2 Frontend - 确认弹窗

- [ ] 6.2.1 监听 confirmation_request 事件
- [ ] 6.2.2 创建 ConfirmationDialog 组件
  - 显示 Skill 名称、描述、参数
  - 确认/取消按钮
- [ ] 6.2.3 调用确认提交 API
- [ ] 6.2.4 测试确认流程

### 6.3 Backend - 日志接收与落库

- [ ] 6.3.1 创建日志接收接口（供 agent-core 调用）
  - POST /internal/logs/conversation
  - POST /internal/logs/skill-invocation
- [ ] 6.3.2 创建 AsyncLogService（异步处理）
  - 使用 @Async 注解
  - 批量写入数据库（可选优化）
- [ ] 6.3.3 实现脱敏逻辑（正则匹配密码、token）
- [ ] 6.3.4 实现截断逻辑（超长内容截断存储）
- [ ] 6.3.5 创建日志查询接口（管理后台使用）

### 6.4 Agent-core 调整

- [ ] 6.4.1 移除直接数据库写入代码
- [ ] 6.4.2 改为 HTTP 上报到 skill-gateway
- [ ] 6.4.3 配置上报地址（环境变量）

---

## 7. 鉴权与安全

### 7.1 Backend - JWT 鉴权

- [ ] 7.1.1 添加 Spring Security 依赖
- [ ] 7.1.2 配置 JWT 工具类（生成、验证 Token）
- [ ] 7.1.3 创建 JwtAuthenticationFilter
  - 从 Header 提取 Token
  - 验证并设置 SecurityContext
- [ ] 7.1.4 创建登录接口（或对接现有认证服务）
  - POST /api/v1/auth/login
- [ ] 7.1.5 配置接口权限
  - 公开接口（/api/health、/login）
  - 需认证接口（其他）
- [ ] 7.1.6 在 Controller 中获取当前用户（@AuthenticationPrincipal）

### 7.2 Backend - 限流与防护

- [ ] 7.2.1 添加限流（Bucket4j 或 RateLimiter）
  - 按用户限流（每分钟 N 次）
  - 全局限流（每秒 N 次）
- [ ] 7.2.2 添加请求参数校验（XSS 防护）
- [ ] 7.2.3 配置 CORS（允许特定域名）
- [ ] 7.2.4 添加敏感操作日志（删除、修改配置）

### 7.3 Agent-core 安全加固

- [ ] 7.3.1 配置仅监听内网地址（127.0.0.1 或内部 IP）
- [ ] 7.3.2 添加 IP 白名单拦截器（仅允许 skill-gateway 访问）
- [ ] 7.3.3 移除对外端口暴露（Docker/K8s 配置）

### 7.4 Frontend - 鉴权集成

- [ ] 7.4.1 创建 Auth Store（管理登录状态、Token）
- [ ] 7.4.2 配置 Axios 拦截器（自动添加 Authorization Header）
- [ ] 7.4.3 处理 401 错误（跳转登录页）
- [ ] 7.4.4 创建登录页面（或对接现有登录）
- [ ] 7.4.5 路由守卫（未登录跳登录页）

---

## 8. 性能优化与监控

### 8.1 数据库优化

- [ ] 8.1.1 分析慢查询（开启 MySQL 慢查询日志）
- [ ] 8.1.2 优化索引（根据查询条件添加）
- [ ] 8.1.3 分页优化（深分页问题）
- [ ] 8.1.4 连接池调优（HikariCP 配置）

### 8.2 缓存优化

- [ ] 8.2.1 添加 Skill 配置缓存（Caffeine）
- [ ] 8.2.2 添加对话基础信息缓存
- [ ] 8.2.3 配置缓存过期策略

### 8.3 监控指标

- [ ] 8.3.1 添加 Micrometer 依赖（Prometheus 格式）
- [ ] 8.3.2 暴露自定义指标
  - 请求延迟（P50/P95/P99）
  - Skill 调用次数
  - 对话数量
- [ ] 8.3.3 配置 Prometheus 抓取（或写入日志）
- [ ] 8.3.4 配置 Grafana 仪表盘（可选）

### 8.4 日志优化

- [ ] 8.4.1 配置结构化日志（JSON 格式）
- [ ] 8.4.2 配置日志收集（ELK 或 Loki）
- [ ] 8.4.3 配置日志轮转（按天/大小）

---

## 9. 测试与验收

### 9.1 单元测试

- [ ] 9.1.1 Service 层单元测试（JUnit + Mockito）
  - ConversationService
  - SkillService
  - SkillExecutionService
- [ ] 9.1.2 Executor 单元测试
  - ApiCallerExecutor（使用 MockRestServiceServer）
  - ComputeExecutor
  - SshExecutor（使用 SSH mock）
- [ ] 9.1.3 目标：核心逻辑覆盖率 > 80%

### 9.2 集成测试

- [ ] 9.2.1 API 集成测试（Spring Boot Test）
  - 使用 @SpringBootTest
  - 使用 TestRestTemplate 或 WebTestClient
- [ ] 9.2.2 数据库集成测试
  - 使用 @DataJpaTest
  - 使用 H2 内存数据库或 Testcontainers
- [ ] 9.2.3 端到端测试（关键场景）
  - 创建对话 → 发送消息 → 接收回复
  - Skill 调用流程
  - 确认流流程

### 9.3 性能测试

- [ ] 9.3.1 单接口压力测试（JMeter 或 k6）
  - 对话列表查询
  - 消息发送接口
- [ ] 9.3.2 并发测试（100 并发用户）
- [ ] 9.3.3 长连接测试（SSE 连接稳定性）
- [ ] 9.3.4 目标：P95 延迟 < 3s，错误率 < 0.1%

### 9.4 安全测试

- [ ] 9.4.1 SQL 注入测试
- [ ] 9.4.2 XSS 测试
- [ ] 9.4.3 越权访问测试（用户 A 访问用户 B 的数据）
- [ ] 9.4.4 敏感信息泄露测试（日志中无密码）

### 9.5 验收测试（按需求文档）

- [ ] 9.5.1 验证 6 个用户故事场景
- [ ] 9.5.2 验证多对话管理功能
- [ ] 9.5.3 验证 Skill 生成功能（如已实现）
- [ ] 9.5.4 验证运行时确认功能
- [ ] 9.5.5 验证历史翻看功能

---

## 10. 文档与上线

### 10.1 接口文档

- [ ] 10.1.1 配置 SpringDoc OpenAPI
- [ ] 10.1.2 添加接口描述、参数说明
- [ ] 10.1.3 生成并导出 OpenAPI JSON/YAML
- [ ] 10.1.4 部署 Swagger UI（访问 /swagger-ui.html）

### 10.2 开发文档

- [ ] 10.2.1 README.md（项目简介、快速启动）
- [ ] 10.2.2 本地开发指南（环境配置、启动步骤）
- [ ] 10.2.3 数据库设计文档（ER 图）
- [ ] 10.2.4 接口调用指南（Frontend 调用示例）
- [ ] 10.2.5 新增 Skill 开发指南

### 10.3 部署文档

- [ ] 10.3.1 服务器环境要求（JDK、MySQL、内存）
- [ ] 10.3.2 Docker 部署指南（Dockerfile、docker-compose）
- [ ] 10.3.3 Kubernetes 部署指南（Deployment、Service、ConfigMap）
- [ ] 10.3.4 配置说明（环境变量、配置文件）
- [ ] 10.3.5 监控告警配置

### 10.4 部署上线

- [ ] 10.4.1 准备生产环境（数据库、服务器）
- [ ] 10.4.2 配置生产环境变量
- [ ] 10.4.3 执行数据库迁移
- [ ] 10.4.4 部署 skill-gateway
- [ ] 10.4.5 部署 frontend
- [ ] 10.4.6 配置 agent-core 访问（内网）
- [ ] 10.4.7 配置域名和 Nginx
- [ ] 10.4.8 健康检查验证
- [ ] 10.4.9 灰度发布（可选，先开放部分用户）

### 10.5 上线后

- [ ] 10.5.1 监控观察（延迟、错误率、资源使用）
- [ ] 10.5.2 收集用户反馈
- [ ] 10.5.3 问题修复（Bugfix 版本）
- [ ] 10.5.4 性能调优（根据实际负载）

---

## 附录：关键配置参考

### 环境变量

```bash
# skill-gateway
SKILL_GATEWAY_PORT=8080
MYSQL_URL=jdbc:mysql://localhost:3306/skill_gateway
MYSQL_USERNAME=
MYSQL_PASSWORD=
AGENT_CORE_URL=http://localhost:3000
JWT_SECRET=
LOG_LEVEL=INFO

# frontend
VITE_API_BASE_URL=http://localhost:8080

# agent-core（仅需配置访问 skill-gateway）
SKILL_GATEWAY_URL=http://skill-gateway:8080
```

### 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| frontend | 5173 (dev) / 80 (prod) | 前端开发服务器或 Nginx |
| skill-gateway | 8080 | 后端服务入口 |
| agent-core | 3000 | 内部服务（不对外）|
| MySQL | 3306 | 数据库 |

---

## 注意事项

1. **Agent-core 复用**：保持现有实现不变，仅调整调用方式和部署
2. **数据库兼容**：MySQL 8+ 必需，JSON 字段支持
3. **版本控制**：每个阶段完成打 Tag，便于回滚
4. **并行开发**：Frontend 和 Backend 可并行，通过 Mock 数据联调
5. **代码审查**：关键模块（Skill 执行、鉴权）需 Code Review
