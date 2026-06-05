## MODIFIED Requirements

### Requirement: MySQL 作为 skill-gateway 运行时数据源

skill-gateway SHALL 使用 MySQL 8.x 作为唯一运行时关系型数据库，数据访问层 SHALL 通过 **MyBatis-Plus 3.5.3.1** 实现，SHALL NOT 依赖 JPA/Hibernate 作为 ORM 框架。

#### Scenario: 开发连接使用配置文件中的 JDBC 参数

- **WHEN** 使用默认 `application.properties` 启动 skill-gateway
- **THEN** 数据源 URL SHALL 指向主机 `127.0.0.1`、端口 `3306`、数据库名 `fishtank`
- **AND** 用户名 SHALL 为 `root`
- **AND** 密码 SHALL 为 `52415241`
- **AND** 驱动类名 SHALL 为 MySQL Connector/J 所提供的 JDBC 驱动类

### Requirement: 配置文件中可见的数据库设置

所有环境相关的 JDBC 与 MyBatis-Plus 设置 SHALL 存放在 Spring 配置文件中（例如 `application.properties`、`application-prod.example.properties` 或按 profile 拆分文件），SHALL NOT 包含任何 JPA/Hibernate 配置（如 `spring.jpa.*`）。

#### Scenario: 生产示例不隐含 H2

- **WHEN** 阅读 `application-prod.example.properties`（或项目约定的生产示例配置）
- **THEN** 其中 SHALL NOT 包含 H2 的 JDBC URL
- **AND** SHALL 体现 MySQL 连接形态与 MyBatis-Plus 配置

### Requirement: MyBatis-Plus 管理表在 MySQL 下可用

MyBatis-Plus SHALL 在 MySQL 上持久化以下逻辑表：**`users`**、**`skills`**、**`audit_logs`**、**`server_ledgers`**、**`llm_http_audit_logs`**、**`skill_ssh_invocation_audits`**、**`gateway_outbound_audit_logs`**、**`system_skills`**，且行为与迁移前业务定义一致。

#### Scenario: 空库首次启动

- **WHEN** 连接到一个已创建但无应用表的空数据库 `fishtank`
- **THEN** 应用启动 SHALL 成功
- **AND** 上述表 SHALL 由 Schema 初始化脚本创建且可供 CRUD 使用

## ADDED Requirements

### Requirement: Spring Boot 2.7.3 + JDK 1.8 构建基线

skill-gateway 的构建与运行时基线 SHALL 为：**Spring Boot 2.7.3** 作为父 POM、**JDK 1.8** 作为 Java 编译与运行时版本、**MyBatis-Plus 3.5.3.1** 作为唯一持久层框架。SHALL NOT 依赖 `spring-boot-starter-data-jpa`、`hibernate-core` 或任何 JPA 实现。

#### Scenario: Maven 编译

- **WHEN** 在 JDK 1.8+ 环境下执行 `mvn clean compile`
- **THEN** 项目 SHALL 成功编译，无 `jakarta.*` 导入残留
- **AND** 所有 `import javax.*` 来自 JDK 或 Servlet API

#### Scenario: 应用启动

- **WHEN** 使用 JDK 1.8 运行时启动编译产物
- **THEN** Spring Boot 应用 SHALL 正常启动
- **AND** MyBatis-Plus 自动配置 SHALL 加载
- **AND** REST 端点（`:18080`）SHALL 正常响应

### Requirement: 对外 API 契约不变

降级重构后，skill-gateway 对外暴露的所有 REST API（端点路径、请求方法、请求/响应体 JSON 结构、HTTP 状态码语义）SHALL 与重构前 **完全一致**，MUST NOT 因框架降级而出现任何契约变更。

#### Scenario: 用户注册/登录

- **WHEN** 客户端向 `POST /api/auth/register` 或 `POST /api/auth/login` 发送与重构前一致的 JSON 请求体
- **THEN** 响应状态码与 JSON 结构 SHALL 与重构前一致

#### Scenario: Skill CRUD

- **WHEN** 客户端对 `/api/skills/**` 执行创建、查询、更新、删除操作
- **THEN** 行为 SHALL 与重构前一致
- **AND** 数据库持久化结果 SHALL 等价

#### Scenario: Linux 脚本执行

- **WHEN** Agent 通过 `POST /api/skills/linux-script` 发送 `serverId` 与 `command`
- **THEN** SSH 执行、凭据解析、返回结果 SHALL 与重构前一致

### Requirement: 审计日志完整性

重构后的审计日志持久化（`audit_logs`、`gateway_outbound_audit_logs`、`llm_http_audit_logs`、`skill_ssh_invocation_audits`）SHALL 与重构前保持相同的字段语义、截断策略与落库时机。

#### Scenario: 审计日志写入

- **WHEN** 触发任意审计写入
- **THEN** 日志行 SHALL 成功持久化
- **AND** 字段内容与截断行为 SHALL 与重构前等价
