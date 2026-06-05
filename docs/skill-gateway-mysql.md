# Skill Gateway：MySQL 配置与表结构说明

本文说明 **skill-gateway**（`backend/skill-gateway`）在迁移到 **MySQL** 后的数据源配置、启动时建表/迁移方式，以及各表的参考建表语句。部署时请以实际环境为准覆盖账号密码，**勿将生产密码提交到仓库**。

## 1. 环境与版本

| 项目 | 说明 |
|------|------|
| 数据库 | **MySQL** 8.x（推荐；与 Connector/J 8 驱动匹配） |
| 字符集 | 连接层使用 **UTF-8**（URL 中 `useUnicode=true`、`characterEncoding=UTF-8`，排序规则示例为 `utf8mb4_unicode_ci`） |
| 应用 ORM | Spring Data JPA + Hibernate |

## 2. 创建数据库（运维一次性执行）

在 MySQL 上创建空库并授权应用账号（库名与默认配置一致为 `fishtank`，可按需修改）：

```sql
CREATE DATABASE IF NOT EXISTS fishtank
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 示例：为应用创建专用用户（生产请替换密码与来源 IP）
-- CREATE USER 'fishtank_app'@'%' IDENTIFIED BY 'change-this-password';
-- GRANT ALL PRIVILEGES ON fishtank.* TO 'fishtank_app'@'%';
-- FLUSH PRIVILEGES;
```

首次启动前只需 **空库** 即可；表结构主要由 **Hibernate** 根据实体生成/更新（见下节）。

## 3. Spring 数据源与 JPA 配置

配置位于：

- 开发默认：`backend/skill-gateway/src/main/resources/application.properties`
- 生产示例：`backend/skill-gateway/src/main/resources/application-prod.example.properties`（复制为 `application-prod.properties` 或通过环境变量覆盖，**不要提交真实密码**）

### 3.1 关键配置项

| 配置项 | 含义 |
|--------|------|
| `spring.datasource.url` | JDBC URL，需包含库名、时区、编码等（示例见仓库内文件） |
| `spring.datasource.driver-class-name` | MySQL 8 使用 `com.mysql.cj.jdbc.Driver` |
| `spring.datasource.username` / `password` | 数据库账号 |
| `spring.jpa.database-platform` | `org.hibernate.dialect.MySQLDialect` |
| `spring.jpa.hibernate.ddl-auto` | 当前为 **`update`**：无表则建表，有表则按实体增量更新（生产环境请结合运维策略评估是否改为 `validate` + 独立迁移） |
| `spring.sql.init.mode` | **`always`**：在 Hibernate 初始化之后执行 `schema.sql` |
| `spring.jpa.defer-datasource-initialization` | **`true`**：保证 **先** 由 Hibernate 建/更新表，**再** 执行 `schema.sql`（与脚本内注释一致） |

### 3.2 JDBC URL 参数说明（示例）

默认形态（节选）：

```text
jdbc:mysql://127.0.0.1:3306/fishtank?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=UTC
```

| 参数 | 作用 |
|------|------|
| `useUnicode` / `characterEncoding` | 使用 Unicode / UTF-8 传输与映射 |
| `connectionCollation` | 连接层排序规则（示例为 `utf8mb4_unicode_ci`） |
| `serverTimezone` | 与 JVM / `Instant` / `LocalDateTime` 存取一致，示例为 `UTC` |

### 3.3 通过环境变量覆盖（生产常见）

Spring Boot 支持以环境变量覆盖，例如：

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

具体以 Spring Boot 文档与当前 Boot 版本为准。

## 4. 表结构从哪里来

1. **JPA 实体**  
   Hibernate 根据 `backend/skill-gateway/.../entity/*.java` 在 `ddl-auto=update` 下创建或更新表。物理列名一般为 **snake_case**（如 `user_id`、`created_at`），与 Spring 默认命名策略一致。

2. **补充脚本 `schema.sql`**  
   路径：`backend/skill-gateway/src/main/resources/schema.sql`  
   在 Hibernate 执行完毕后运行，用于 **兼容老版本 MySQL** 的增量变更（如 `ADD COLUMN`、补索引、在表不存在时 `CREATE TABLE llm_http_audit_logs` 等）。脚本内使用 `INFORMATION_SCHEMA` 与动态 SQL，避免在不支持 `IF NOT EXISTS` 的语法上硬失败。

`skills` 等业务数据由 JPA 持久化；网关进程重启**不会**自动清空或删除库内 skill 行。

## 5. 逻辑表清单

| 表名 | 说明 |
|------|------|
| `users` | 用户（6 位 ID、昵称、头像、每用户 LLM 配置等） |
| `skills` | Skill 定义（含 `configuration` JSON、`visibility`、`created_by` 等） |
| `server_ledgers` | 用户维度的服务器台账（SSH 等） |
| `audit_logs` | Skill 执行审计（Agent、技能名、命令/URL、参数、状态等） |
| `llm_http_audit_logs` | LLM 原始 HTTP 审计（由 agent-core 经网关落库；可由 Hibernate 与/或 `schema.sql` 创建） |

## 6. 参考 DDL（与实体一致，供运维核对）

以下由实体字段整理，**实际列类型以 Hibernate 在 MySQL 上生成的为准**。若与线上一致性校验有出入，以数据库 `SHOW CREATE TABLE` 结果为准。

### 6.1 `users`

```sql
-- 参考：Hibernate 将 String 长度未标注时映射为 VARCHAR(255) 等，以实际为准
CREATE TABLE users (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  nickname VARCHAR(255) NULL,
  avatar VARCHAR(255) NULL,
  created_at DATETIME(6) NULL,
  llm_api_base VARCHAR(512) NULL,
  llm_model_name VARCHAR(128) NULL,
  llm_api_key VARCHAR(2048) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2 `skills`

```sql
CREATE TABLE skills (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  type VARCHAR(255) NOT NULL,
  configuration TEXT NULL,
  execution_mode VARCHAR(255) NULL,
  enabled BIT(1) NOT NULL,
  requires_confirmation BIT(1) NOT NULL DEFAULT b'0',
  visibility VARCHAR(16) NOT NULL,
  avatar VARCHAR(32) NULL,
  created_by VARCHAR(128) NULL,
  created_at DATETIME(6) NULL,
  updated_at DATETIME(6) NULL,
  UNIQUE KEY UK_skills_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

（`BIT`/`BOOLEAN` 在不同 MySQL 版本与方言下可能显示为 `tinyint(1)`，属正常。）

### 6.3 `server_ledgers`

实体上存在 **唯一约束**：`(user_id, ip)`、`(user_id, name)`。

```sql
CREATE TABLE server_ledgers (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ip VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NULL,
  updated_at DATETIME(6) NULL,
  UNIQUE KEY uq_server_ledgers_user_ip (user_id, ip),
  UNIQUE KEY uq_server_ledgers_user_name (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.4 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(255) NULL,
  skill_name VARCHAR(255) NULL,
  command_or_url VARCHAR(255) NULL,
  params TEXT NULL,
  status VARCHAR(255) NULL,
  timestamp DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.5 `llm_http_audit_logs`

与实体及 `schema.sql` 中「表不存在则创建」的语句一致：

```sql
CREATE TABLE llm_http_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(128) NULL,
  session_id VARCHAR(128) NULL,
  correlation_id VARCHAR(64) NOT NULL,
  direction VARCHAR(32) NOT NULL,
  recorded_at DATETIME(6) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_llm_http_audit_user_recorded (user_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 7. `schema.sql` 补充说明（仓库内为准）

仓库中完整脚本见：

`backend/skill-gateway/src/main/resources/schema.sql`

内容主要包括：

- 为 `skills` 补 `requires_confirmation` 等列（若缺失）并设默认值；
- 为 `server_ledgers` 补 `name`、数据修复与唯一索引 `uq_server_ledgers_user_name`；
- 若不存在则 **创建** `llm_http_audit_logs`（与上一节 DDL 一致）。

部署或排查迁移问题时，应 **直接以该文件为权威增量脚本**，并与本节参考 DDL 对照。

## 8. 相关文档与规范

- 部署与验证：`docs/mac-local-verify-deploy.md`、`docs/single-host-deploy.md`
- 架构总览：`docs/ARCHITECTURE.md`
- OpenSpec：`openspec/specs/skill-gateway-mysql/spec.md`（能力级约定）
