## Why

当前 skill-gateway 基于 **Spring Boot 3.2.3** + **JDK 17** + **JPA/Hibernate** 构建，目标部署环境要求 **JDK 1.8** 兼容，且团队决策以 **MyBatis-Plus 3.5.3.1** 替代 JPA 作为持久层框架。为此需要对 skill-gateway 进行**框架降级与持久层替换**的重构，在所有对外功能保持不变的约束下完成迁移。

## What Changes

- **BREAKING（构建/运行时）**：Spring Boot 父 POM `3.2.3` → `2.7.3`
- **BREAKING（构建/运行时）**：JDK 编译目标 `17` → `1.8`
- **BREAKING（持久层）**：`spring-boot-starter-data-jpa`（Hibernate）→ `mybatis-plus-boot-starter:3.5.3.1`
- **BREAKING（命名空间）**：所有 `jakarta.*` 导入 → `javax.*`（Spring Boot 2.x 仍使用 Java EE 命名空间）
- **BREAKING（安全配置）**：Spring Security 6 API → Spring Security 5 API（`SecurityFilterChain` 等类路径不变但行为细节可能不同）
- **BREAKING（数据库驱动）**：`mysql-connector-j` → `mysql-connector-java`（Spring Boot 2.7 管理的 MySQL 驱动 artifactId 不同），或显式声明 `mysql-connector-j` 版本
- **HTTP 客户端**：`httpclient5` → 降级/替换为 JDK 1.8 兼容方案（`httpclient5` 本身兼容 JDK 8，可保留但需确认版本）
- 所有控制器、服务、数据访问层功能 **SHALL 保持不变**；对外 API 契约、数据库表结构、审计行为、SSH 执行逻辑 **MUST NOT** 变更

## Capabilities

### New Capabilities

（无；本变更不新增产品能力。）

### Modified Capabilities

- `skill-gateway-mysql`：数据持久化实现由 JPA/Hibernate 改为 MyBatis-Plus，表结构与 CRUD 语义保持不变；DDL 自动建表策略由 `spring.jpa.hibernate.ddl-auto=update` 改为 MyBatis-Plus 或独立迁移脚本控制
- `skill-gateway-downgrade`（新建）：定义降级后的构建、框架版本与运行时基线

## Impact

- **build/pom.xml**：父 POM、java.version、所有 starter 依赖、插件配置
- **entity 包**：9 个 JPA 实体全部改为 MyBatis-Plus 实体（`@Entity` → `@TableName`，`@Id`/`@GeneratedValue` → `@TableId`，`@Column` → `@TableField` 等）
- **repository 包**：8 个 Spring Data JPA Repository → MyBatis-Plus `BaseMapper<T>` 接口
- **service 包**：11 个 Service 中的 JPA 调用（`repository.save()`、`repository.findById()` 等）→ MyBatis-Plus 等价调用（`mapper.insert()`、`mapper.selectById()` 等）
- **config 包**：`SecurityConfig.java` 适配 Spring Security 5.x；`@EnableJpaRepositories` → MyBatis-Plus 配置
- **application.properties**：`spring.jpa.*` 配置移除，替换为 MyBatis-Plus + 数据源配置
- **test**：H2 测试数据库的 JPA 方言/自动建表逻辑替换为 MyBatis-Plus + H2 兼容方案；单测中的 `@DataJpaTest` → MyBatis-Plus Test 或 Spring Boot Test
