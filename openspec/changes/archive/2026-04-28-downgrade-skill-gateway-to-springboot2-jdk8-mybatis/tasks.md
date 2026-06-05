## 1. POM 与构建配置

- [ ] 1.1 修改 `pom.xml`：`spring-boot-starter-parent` → `2.7.3`，`java.version` → `1.8`
- [ ] 1.2 移除 `spring-boot-starter-data-jpa` 依赖，新增 `mybatis-plus-boot-starter:3.5.3.1`
- [ ] 1.3 调整 MySQL 驱动：移除/替换 `mysql-connector-j` → `mysql-connector-java`（或显式声明兼容版本）
- [ ] 1.4 处理 `httpclient5`：保留并显式声明兼容版本（如 `5.2.1`），或降级为 `httpcomponents:httpclient:4.5.14`
- [ ] 1.5 调整 `maven-compiler-plugin`：`source/target` → `1.8`
- [ ] 1.6 移除 `spring-boot-starter-webflux`（如 non-Reactive 业务不依赖）

## 2. 命名空间迁移：jakarta → javax

- [ ] 2.1 全局替换 `import jakarta.persistence.*` → `import javax.persistence.*`（在实体重写前，先迁命名空间）
- [ ] 2.2 全局替换 `import jakarta.servlet.*` → `import javax.servlet.*`
- [ ] 2.3 全局替换 `import jakarta.annotation.*` → `import javax.annotation.*`
- [ ] 2.4 全局替换 `import jakarta.validation.*` → `import javax.validation.*`
- [ ] 2.5 全局替换 `import jakarta.transaction.*` → `import javax.transaction.*`

## 3. 实体层：JPA Entity → MyBatis-Plus Entity

- [ ] 3.1 重写 `User`：`@Entity`/`@Table` → `@TableName`，`@Id`/`@GeneratedValue` → `@TableId(type = IdType.AUTO)`，`@Column` → `@TableField`，`@Enumerated(EnumType.STRING)` → `@EnumValue`
- [ ] 3.2 重写 `Skill`（同上映射规则）
- [ ] 3.3 重写 `AuditLog`（同上映射规则）
- [ ] 3.4 重写 `ServerLedger`（同上映射规则）
- [ ] 3.5 重写 `SystemSkill`（同上映射规则）
- [ ] 3.6 重写 `SkillSshInvocationAudit`（同上映射规则）
- [ ] 3.7 重写 `LlmHttpAuditLog`（同上映射规则）
- [ ] 3.8 重写 `GatewayOutboundAuditLog`（同上映射规则）
- [ ] 3.9 处理 `SkillVisibility`（枚举类，确保 MyBatis-Plus TypeHandler 或 `@EnumValue` 兼容）

## 4. Repository → Mapper 层

- [ ] 4.1 `UserRepository extends JpaRepository` → `UserMapper extends BaseMapper<User>`，迁移所有调用点
- [ ] 4.2 `SkillRepository` → `SkillMapper`，迁移所有调用点（含自定义查询）
- [ ] 4.3 `AuditLogRepository` → `AuditLogMapper`
- [ ] 4.4 `ServerLedgerRepository` → `ServerLedgerMapper`（含 `findByUserIdAndIp` 等自定义查询 → LambdaQueryWrapper）
- [ ] 4.5 `SystemSkillRepository` → `SystemSkillMapper`
- [ ] 4.6 `SkillSshInvocationAuditRepository` → `SkillSshInvocationAuditMapper`
- [ ] 4.7 `LlmHttpAuditLogRepository` → `LlmHttpAuditLogMapper`
- [ ] 4.8 `GatewayOutboundAuditLogRepository` → `GatewayOutboundAuditLogMapper`

## 5. Service 层适配

- [ ] 5.1 `UserService`：`repository.save()` → `mapper.insert()`/`updateById()`，`findById()` → `selectById()`，`findByUsername()` → LambdaQueryWrapper
- [ ] 5.2 `SkillService`：同上模式，处理分页查询（`Page<T>` 分页）
- [ ] 5.3 `ServerLedgerService`：CRUD + 自定义查询（`findByUserIdAndIp`、`findByUserId` 等）
- [ ] 5.4 `AuditLog` 相关 Service（`GatewayOutboundAuditService`、`LlmHttpAuditService`）：适配 insert 操作
- [ ] 5.5 `SystemSkillService`：CRUD 适配
- [ ] 5.6 `BuiltinToolExecutionService`：依赖 Repository 的调用点
- [ ] 5.7 `SSHExecutorService`：如直接依赖 Repository，需适配
- [ ] 5.8 `SecurityFilterService`：如依赖 `UserRepository`，需适配

## 6. Config 层适配

- [ ] 6.1 `SecurityConfig.java`：适配 Spring Security 5.x（替换已废弃 API 如 `antMatchers` → `requestMatchers`（SB 2.7 均可用），移除 SB 3.x 专属 API）
- [ ] 6.2 `SkillGatewayHttpClientConfig.java`：如依赖 `httpclient5` 的配置类，确认 SB 2.7 环境下正常
- [ ] 6.3 新增 MyBatis-Plus 配置类或确认 `application.properties` 中的 `mybatis-plus.*` 配置生效
- [ ] 6.4 如使用 `@EnableJpaRepositories` / `@EntityScan`，移除并替换为 MyBatis-Plus `@MapperScan`

## 7. 配置文件（application.properties）

- [ ] 7.1 移除所有 `spring.jpa.*` 配置
- [ ] 7.2 新增 `mybatis-plus.*` 配置（mapper-locations、type-aliases-package、日志等）
- [ ] 7.3 确认数据源配置（`spring.datasource.*`）保持不变
- [ ] 7.4 新增 Schema 初始化配置（`spring.sql.init.mode`、`schema-locations`）
- [ ] 7.5 创建 `schema-mysql.sql` 建表 DDL（与原有 JPA 实体映射的 MySQL 表结构一致）
- [ ] 7.6 更新示例生产配置（`application-prod.example.properties`）

## 8. 测试适配

- [ ] 8.1 创建 `schema-h2.sql` 供测试用（H2 MySQL 兼容模式下的建表 DDL）
- [ ] 8.2 适配测试配置文件（`application-test.properties`）：H2 数据源 + MyBatis-Plus + schema 初始化
- [ ] 8.3 移除 `@DataJpaTest` 注解，改用 `@SpringBootTest` / `@MybatisPlusTest`
- [ ] 8.4 更新所有测试类中的 Repository 注入 → Mapper 注入，方法调用适配
- [ ] 8.5 运行全量测试套件 (`mvn test`)，确保所有用例通过

## 9. 编译与启动验证

- [ ] 9.1 `mvn clean compile` 在 JDK 8 下成功（零编译错误）
- [ ] 9.2 `mvn clean package` 成功构建可执行 JAR
- [ ] 9.3 `java -jar` 启动应用，确认 REST 端点可访问
- [ ] 9.4 验证所有 `/api/**` 端点响应一致

## 10. OpenSpec 归档

- [ ] 10.1 实现完成后对照 delta spec 自检
- [ ] 10.2 将本 change 的 spec delta 合并入 `openspec/specs/skill-gateway-downgrade/spec.md`
- [ ] 10.3 更新 `openspec/specs/skill-gateway-mysql/spec.md`（MODIFIED delta）
