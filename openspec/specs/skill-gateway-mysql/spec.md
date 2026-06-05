# skill-gateway-mysql Specification

## Purpose

约定 skill-gateway 在开发与生产环境中使用 MySQL 作为运行时关系型数据库，与仓库内 JDBC/JPA 配置及迁移脚本一致。

## Requirements

### Requirement: MySQL 作为 skill-gateway 运行时数据源

skill-gateway SHALL 使用 MySQL 8.x 作为唯一运行时关系型数据库（开发默认配置与生产可覆盖配置均指向 MySQL），SHALL NOT 在默认运行时 classpath 中依赖 H2 作为应用数据源。

#### Scenario: 开发连接使用配置文件中的 JDBC 参数

- **WHEN** 使用默认 `application.properties` 启动 skill-gateway
- **THEN** 数据源 URL SHALL 指向主机 `127.0.0.1`、端口 `3306`、数据库名 `fishtank`
- **AND** 用户名 SHALL 为 `root`
- **AND** 密码 SHALL 为 `52415241`
- **AND** 驱动类名 SHALL 为 MySQL Connector/J 所提供的 JDBC 驱动类

### Requirement: 配置文件中可见的数据库设置

所有环境相关的 JDBC 与 JPA 方言设置 SHALL 存放在 Spring 配置文件中（例如 `application.properties`、`application-prod.example.properties` 或按 profile 拆分文件），使运维与开发者无需阅读 Java 代码即可识别数据源类型与连接参数（生产密码允许为占位符或由环境变量注入）。

#### Scenario: 生产示例不隐含 H2

- **WHEN** 阅读 `application-prod.example.properties`（或项目约定的生产示例配置）
- **THEN** 其中 SHALL NOT 包含 H2 的 JDBC URL 或 `H2Dialect`
- **AND** SHALL 体现 MySQL 连接形态与方言配置

### Requirement: JPA 管理表在 MySQL 下可用

Hibernate/JPA SHALL 在 MySQL 上创建或更新以下逻辑表并用于持久化：**`users`**、**`skills`**、**`audit_logs`**、**`server_ledgers`**，且行为与迁移前业务定义一致（列语义、约束由实体与现有逻辑决定）。

#### Scenario: 空库首次启动

- **WHEN** 连接到一个已创建但无应用表的空数据库 `fishtank`
- **THEN** 应用启动 SHALL 成功
- **AND** 上述四张表 SHALL 存在且可供 CRUD 使用

### Requirement: 预迁移与 MySQL 元数据兼容

在 Hibernate 执行 schema 更新之前运行的预迁移逻辑（例如扩展 skill 清理）SHALL 在 MySQL 上正确检测目标表是否存在并执行等价 SQL，不受 H2 与 MySQL 在 `DatabaseMetaData` 表名大小写差异的影响。

#### Scenario: 预迁移不因表名大小写跳过

- **WHEN** `skills` 表已在 MySQL 中存在（按服务器默认命名规则）
- **THEN** 预迁移组件 SHALL 仍能识别该表并执行既定清理语句（若适用）
