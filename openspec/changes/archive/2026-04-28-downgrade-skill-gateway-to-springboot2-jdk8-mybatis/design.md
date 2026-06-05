# 设计文档：skill-gateway 降级 Spring Boot 2.7 + JDK 8 + MyBatis-Plus

## 1. 依赖变更清单

### 1.1 POM 级变更

| 项 | 当前值 | 目标值 |
|---|---|---|
| `spring-boot-starter-parent` | `3.2.3` | `2.7.3` |
| `java.version` | `17` | `1.8` |
| `maven-compiler-plugin source/target` | `17` | `1.8` |

### 1.2 依赖替换

| 操作 | 旧依赖 | 新依赖 |
|---|---|---|
| **移除** | `spring-boot-starter-data-jpa` | — |
| **新增** | — | `com.baomidou:mybatis-plus-boot-starter:3.5.3.1` |
| **保留/调整** | `mysql-connector-j` (runtime) | `mysql:mysql-connector-java` (runtime, SB 2.7 管理版本) 或显式声明 `com.mysql:mysql-connector-j:8.0.33` |
| **保留** | `com.hierynomus:sshj:0.38.0` | 不变（兼容 JDK 8） |
| **保留** | `org.apache.httpcomponents.client5:httpclient5` | 移除或显式降级为 `org.apache.httpcomponents:httpclient:4.5.14`（如 SB 2.7 不管理 `httpclient5`） |
| **保留** | `spring-boot-starter-webflux` | SB 2.7 支持 WebFlux，保留（如需要） |
| **保留** | `h2` (test) | 保留，适配 MyBatis-Plus 测试 |
| **保留** | `org.projectlombok:lombok` | 不变 |

## 2. 命名空间迁移：jakarta → javax

Spring Boot 3.x 使用 Jakarta EE 9+ (`jakarta.*`)，Spring Boot 2.x 使用 Java EE (`javax.*`)。

所有 `import jakarta.*` SHALL 替换为 `import javax.*`：

| 旧 (SB3) | 新 (SB2) |
|---|---|
| `jakarta.persistence.*` | `javax.persistence.*`（但 JPA 实体将被重写） |
| `jakarta.servlet.*` | `javax.servlet.*` |
| `jakarta.annotation.*` | `javax.annotation.*` |
| `jakarta.validation.*` | `javax.validation.*` |

## 3. 持久层迁移：JPA → MyBatis-Plus

### 3.1 实体变更

每张表的实体类 SHALL 保持相同的类名与字段名，注解替换如下：

**JPA 写法（旧）：**
```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "username", nullable = false, unique = true)
    private String username;
    
    @Column(name = "password_hash")
    private String passwordHash;
}
```

**MyBatis-Plus 写法（新）：**
```java
@TableName("users")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    
    @TableField(value = "username")
    private String username;
    
    @TableField(value = "password_hash")
    private String passwordHash;
}
```

### 3.2 Repository → Mapper

| 旧 (JPA Repository) | 新 (MyBatis-Plus Mapper) |
|---|---|
| `interface UserRepository extends JpaRepository<User, Long>` | `interface UserMapper extends BaseMapper<User>` |
| `userRepository.save(user)` | `userMapper.insert(user)` / `userMapper.updateById(user)` |
| `userRepository.findById(id)` | `userMapper.selectById(id)` |
| `userRepository.findAll()` | `userMapper.selectList(null)` |
| `userRepository.deleteById(id)` | `userMapper.deleteById(id)` |
| 自定义 `@Query` 方法 | XML 映射或 `@Select`/LambdaQueryWrapper |
| `userRepository.findByUsername(username)` | `userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username))` |

### 3.3 涉及的 9 个实体 / 8 个 Repository

| 实体 | JPA Repository (旧) | MyBatis-Plus Mapper (新) |
|---|---|---|
| `User` | `UserRepository` | `UserMapper` |
| `Skill` | `SkillRepository` | `SkillMapper` |
| `AuditLog` | `AuditLogRepository` | `AuditLogMapper` |
| `ServerLedger` | `ServerLedgerRepository` | `ServerLedgerMapper` |
| `SystemSkill` | `SystemSkillRepository` | `SystemSkillMapper` |
| `SkillSshInvocationAudit` | `SkillSshInvocationAuditRepository` | `SkillSshInvocationAuditMapper` |
| `LlmHttpAuditLog` | `LlmHttpAuditLogRepository` | `LlmHttpAuditLogMapper` |
| `GatewayOutboundAuditLog` | `GatewayOutboundAuditLogRepository` | `GatewayOutboundAuditLogMapper` |

## 4. 配置变更（application.properties）

**移除配置：**
```
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect
spring.jpa.properties.hibernate.format_sql=true
```

**新增/替换配置：**
```
# MyBatis-Plus
mybatis-plus.mapper-locations=classpath*:/mapper/**/*.xml
mybatis-plus.type-aliases-package=com.lobsterai.skillgateway.entity
mybatis-plus.configuration.log-impl=org.apache.ibatis.logging.stdout.StdOutImpl
mybatis-plus.global-config.db-config.id-type=auto

# MySQL DDL 自动建表（如需要，由 MyBatis-Plus 或 schema.sql 控制）
# spring.sql.init.mode=always
# spring.sql.init.schema-locations=classpath:schema-mysql.sql
```

## 5. Security 配置适配

Spring Security 5.x（SB 2.7）与 6.x（SB 3）的 API 基本兼容，但需注意：

- `SecurityFilterChain` Bean 定义方式兼容（两者均使用）
- 如使用了 `authorizeHttpRequests`（lambda DSL），SB 2.7 支持
- `antMatchers` 在 SB 2.7 中可用（SB 3 中已移除，改用 `requestMatchers`）
- CSRF、CORS 配置基本兼容
- 如使用 `@EnableWebSecurity`，两者均可

## 6. 测试适配

- 单元测试：移除 `@DataJpaTest`，改用 `@SpringBootTest` + MyBatis-Plus 自动配置
- H2 测试数据库：保留 `h2` 依赖（`scope=test`），配置 MyBatis-Plus 对 H2 的兼容
- H2 数据源 URL：`jdbc:h2:mem:testdb;MODE=MySQL;DATABASE_TO_LOWER=TRUE`

## 7. 风险评估

| 风险 | 缓解 |
|---|---|
| JPA `ddl-auto=update` 自动维护表，MyBatis-Plus 默认不自动建表 | 提供 `schema-mysql.sql` / `schema-h2.sql` 脚本，由 `spring.sql.init` 控制建表 |
| JPA 关联查询（`@OneToMany` 等）在实体间有隐式级联 | 当前实体间未使用 JPA 关联注解（无 `@OneToMany`/`@ManyToOne`），迁移风险低 |
| `httpclient5` 与 SB 2.7 自带的 `httpclient4` 版本冲突 | 建议统一使用 `httpclient5`（显式声明 `5.2.1`），或全部降级回 `httpcomponents:httpclient:4.5.14` |
| `spring-boot-starter-webflux` 在 SB 2.7 中仍可用 | 保留，功能不变 |
| SSH 库 `sshj:0.38.0` 在 JDK 8 上的兼容性 | `sshj` 官方宣称支持 JDK 8+，低风险 |
| Spring Security 5 与 6 的 `PasswordEncoder` 接口差异 | 接口一致，仅包路径不同 |
