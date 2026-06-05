## Context

skill-gateway 当前使用 **H2 文件库**（`jdbc:h2:file:...`），`spring.jpa.hibernate.ddl-auto=update` 由 Hibernate 维护 schema。JPA 实体映射表：**`users`**、**`skills`**、**`audit_logs`**、**`server_ledgers`**。`SkillTablePreMigration` 在 Hibernate 启动前执行 SQL，并通过 `DatabaseMetaData.getTables` 探测 **`SKILLS`** 表是否存在。

## Goals / Non-Goals

**Goals:**

- 开发与默认配置改为连接 **MySQL 8.x**，JDBC URL、驱动类、账号等写在 **配置文件**中（开发环境使用既定本机参数）。
- **pom.xml** 以 MySQL 驱动为运行时依赖；移除默认的 H2 runtime 依赖（或将其限制在测试作用域）。
- 生产示例与文档中的数据源示例与 H2 脱钩，改为 MySQL 形态（凭据仍用占位或环境变量）。
- 验证实体与预迁移逻辑在 MySQL 下无回归（含表名元数据大小写）。

**Non-Goals:**

- 不改变 SkillGateway 对外 REST 契约与业务规则。
- 不强制提供一键从旧 H2 文件到 MySQL 的自动迁移工具（可作为可选步骤或文档说明）。
- 不引入 Flyway/Liquibase，除非实现阶段发现 `ddl-auto=update` 不足以处理已有生产数据（可作为后续增量）。

## Decisions

1. **MySQL 驱动与方言**  
   使用 **`com.mysql:mysql-connector-j`**（Spring Boot 3.2 托管版本）。Hibernate 方言使用 **`org.hibernate.dialect.MySQLDialect`** 或 **`MySQL8Dialect`**（以 Boot/Hibernate 推荐为准）。  
   **备选**：MariaDB 驱动 — 未选，因目标明确为 MySQL。

2. **配置位置**  
   在 **`application.properties`** 中完整写出开发用连接信息（含用户给定密码），满足「配置内容展现在配置文件中」；**`application-prod.example.properties`** 使用占位符或示例 URL，并注释说明生产用环境变量覆盖。  
   **备选**：仅 `application-dev.properties` — 若团队希望默认 profile 仍为「无密码文件」，可再拆 profile；当前按用户要求默认开发文件即 MySQL。

3. **数据库与字符集**  
   连接 URL 包含库名 **`fishtank`**，并建议 `createDatabaseIfNotExist` **不**依赖（由运维/开发者先建库），URL 中增加 **`characterEncoding=utf8`** / **`connectionCollation=utf8mb4_unicode_ci`** 等参数以保证 emoji 与中文与现有实体一致。  
   **备选**：`utf8mb4` 在服务端默认 — 在 URL 显式指定更稳妥。

4. **H2 Console**  
   移除 **`spring.h2.console.enabled`** 及相关依赖引用。

5. **测试**  
   优先：**`@DataJpaTest` / 集成测试** 使用 **Testcontainers MySQL** 或与生产一致的配置；若短期成本过高，可暂保留 **H2 test scope + MySQL 模式**（`MODE=MySQL`）但需在 tasks 中记为技术债。  
   **备选**：全量 Testcontainers — 更真实，CI 需 Docker。

6. **`SkillTablePreMigration` 表名探测**  
   MySQL 对未加引号标识符的大小写规则与 H2 不同。实现 SHALL 使用与 INFORMATION_SCHEMA 一致的表名（通常为 **小写 `skills`**），或在探测时同时尝试 `skills` / `SKILLS`，避免预迁移被跳过或误报。

## Risks / Trade-offs

- **[Risk] 明文密码进入版本库** → **Mitigation**：在 `application.properties` 注明仅限本地开发；生产必须通过环境变量或外部配置覆盖；可考虑 `.gitignore` 本地 `application-local.properties`（若团队接受后续重构）。
- **[Risk] `ddl-auto=update` 在 MySQL 上与历史 H2 数据不一致** → **Mitigation**：新环境空库由 Hibernate 建表；从 H2 迁数据需导出/导入或一次性脚本，在文档中说明。
- **[Risk] 集成测试未覆盖 MySQL 方言差异** → **Mitigation**：至少一次在 Testcontainers 或真实 MySQL 上跑通 `mvn test`。

## Migration Plan

1. 在本机安装 MySQL，创建数据库 **`fishtank`**（`utf8mb4`）。
2. 合并代码：依赖、配置文件、`SkillTablePreMigration` 调整。
3. 冷启动 skill-gateway，确认四张表创建或更新成功。
4. 若有旧 H2 数据需保留：导出后再导入 MySQL（字段顺序与类型需人工核对），不在本设计强制自动化。
5. **回滚**：恢复 H2 依赖与旧配置；使用备份的 H2 文件或重新生成开发数据。

## Open Questions

- CI 环境是否已提供 Docker（决定是否默认采用 Testcontainers）。
- 生产环境 MySQL 是否由运维统一提供（连接池参数、`sslMode` 等是否在首轮实现）。
