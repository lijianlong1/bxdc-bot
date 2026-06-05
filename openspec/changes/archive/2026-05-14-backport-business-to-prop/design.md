## Context

`low-version` 分支包含已验证的业务逻辑，需要迁移到 `prop` 分支的 Gateway Java 端。两个分支的核心差异在于持久层框架：

- **prop**: Spring Data JPA (`JpaRepository`) + `jakarta.persistence.*` 注解
- **low-version**: MyBatis-Plus (`BaseMapper`) + `com.baomidou.mybatisplus.annotation.*` 注解

业务逻辑（Service 层逻辑、Controller 端点逻辑）完全一致，仅需替换数据访问层调用。

## Decisions

### 1. 实体类：JPA 注解映射

**选择**：新建实体类使用 prop 一致风格的 JPA 注解。

**对照表**：

| 概念 | MyBatis-Plus (low-version) | JPA (prop) |
|------|---------------------------|------------|
| 表映射 | `@TableName("async_tasks")` | `@Entity` + `@Table(name = "async_tasks")` |
| 主键自增 | `@TableId(type = IdType.AUTO)` | `@Id` + `@GeneratedValue(strategy = GenerationType.IDENTITY)` |
| 列映射 | `@TableField("field_id")` | `@Column(name = "field_id")` |
| 插入时填充 | `@TableField(fill = FieldFill.INSERT)` | `@PrePersist` 方法 |
| 逻辑删除 | `@TableLogic` | 无（代码中手动拼接 deleted=0） |

**AsyncTask 对照示例**：

```java
// === MyBatis-Plus (low-version) ===
@TableName("async_tasks")
public class AsyncTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    @TableField("skill_id")
    private Long skillId;
    // ...
}

// === JPA (prop) ===
@Entity
@Table(name = "async_tasks")
public class AsyncTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "skill_id")
    private Long skillId;
    // ...
}
```

### 2. Repository 层：JpaRepository 替代 BaseMapper

**选择**：为新增实体创建 `JpaRepository` 接口，与 prop 现有风格一致。

**SkillTextPromptRepository**：

```java
@Repository
public interface SkillTextPromptRepository extends JpaRepository<SkillTextPrompt, Long> {
    Optional<SkillTextPrompt> findByFieldId(String fieldId);
}
```

无需写 JPQL，Spring Data 自动从方法名推导。

**AsyncTaskRepository 的复杂查询**：

low-version 中 `AsyncTaskMapper.findPendingOrPolling`：

```java
// MyBatis-Plus
@Select("SELECT ... FROM async_tasks WHERE status IN ('PENDING','POLLING') "
    + "AND (last_polled_at IS NULL OR TIMESTAMPDIFF(SECOND, last_polled_at, NOW()) >= poll_interval_seconds) "
    + "ORDER BY created_at ASC LIMIT #{limit}")
List<AsyncTask> findPendingOrPolling(int limit);
```

prop 适配用 `@Query` 或 Specification：

```java
// JPA
@Repository
public interface AsyncTaskRepository extends JpaRepository<AsyncTask, Long> {
    List<AsyncTask> findByStatusIn(List<String> statuses);

    @Query("SELECT t FROM AsyncTask t WHERE t.status IN ('PENDING','POLLING') "
        + "AND (t.lastPolledAt IS NULL OR FUNCTION('TIMESTAMPDIFF', 'SECOND', t.lastPolledAt, CURRENT_TIMESTAMP) >= t.pollIntervalSeconds) "
        + "ORDER BY t.createdAt ASC")
    List<AsyncTask> findPendingOrPolling(Pageable pageable);
}
```

### 3. Service 层适配

**AsyncTaskPollingService 核心职责不变**：`findPendingOrPollingTasks`、`evaluateCompletion`、`evaluateFailure`、`extractTaskId`、`extractResult`、`updateStatus`、`updatePollResult` — 仅将 `asyncTaskMapper.updateById(task)` 替换为 `asyncTaskRepository.save(task)`。

**MyBatis-Plus 的 `updateById`** (全字段更新) vs **JPA 的 `save`** (存在则更新)：对已通过 `findById` 加载的实体，`save` 行为一致。

风险点：MyBatis-Plus `updateById` 对 null 字段不更新（默认策略），但 JPA `save` 会更新所有字段。需要确保 `findById` 获取完整实体后再修改。

### 4. 不需要变动的文件

- **Agent Core** (`backend/agent-core/`)：TypeScript 编译产物在两个分支一致，无需任何修改
- **前端** (`frontend/`)：Vue 组件在两个分支一致，无需任何修改
- **`pom.xml`**：保持 prop 版本不变（Spring Boot 3.2.3 + Java 17）
- **已有 JPA entity**：`Skill.java`、`User.java` 等保持 JPA 注解不变
- **已有 JPA repository**：全部保留

### 5. SecurityConfig 语法差异

prop 使用 `authorizeHttpRequests`（Spring Security 6.x API），low-version 使用 `authorizeRequests`（Spring Security 5.x API）。

**不改变原有语法**，仅在新位置插入放通规则：

```java
// prop — 使用 requestMatchers
.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/skills", "/api/skills/*").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/skills/async-tasks/*/wait").permitAll()  // 新增
    .requestMatchers(HttpMethod.GET, "/api/skills/text-prompts", "/api/skills/text-prompts/**").permitAll()  // 新增
    .requestMatchers(HttpMethod.GET, "/api/system-skills/**").permitAll()
    .requestMatchers("/api/skills/**").authenticated()
    // ...
)
```

### 6. ScheduleConfig（@EnableScheduling）

prop 中 `@EnableScheduling` 需要添加到 `SkillGatewayApplication` 或独立的 `SchedulingConfig` 配置类。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| JPA `save` 覆盖所有字段（null 字段也写入 DB） | `updateXxx` 方法中先 `findById` 获取完整实体再修改，确保不会意外置空字段 |
| `TIMESTAMPDIFF` 函数在 JPQL 中不标准 | MySQL 实际支持，且 `FUNCTION()` 可调用数据库原生函数；若不可用则改为 Java 侧过滤 |
| 忘记倒入 `import jakarta.persistence.*`（非 `javax`） | IDE 会立即报错，编译期发现 |

## Migration Plan

1. 从 `low-version` 分支检出 `feature/backport-business-to-prop` 分支（基于 `prop`）
2. 按 tasks.md 顺序逐一添加/修改文件
3. 编译验证：`mvn compile`
4. 数据库执行 DDL（与 low-version 一致的 3 个文件）
5. 部署验证
