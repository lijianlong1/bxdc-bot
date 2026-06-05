## Why

H2 文件库便于单机快速启动，但与生产常见的 MySQL 运维、备份与多实例部署不一致。将 skill-gateway 的持久化迁移到 MySQL，使开发与部署使用同一类数据库，减少方言与行为差异带来的风险。

## What Changes

- 将 **skill-gateway**（Spring Data JPA）的默认数据源从 **H2 文件库** 改为 **MySQL 8.x**，覆盖 JPA 管理的全部表：**`users`**、**`skills`**、**`audit_logs`**、**`server_ledgers`**。
- **Maven**：移除运行时 H2 依赖，加入 MySQL JDBC 驱动；按需保留 H2 为 `test` scope（若测试仍用内存 H2）或统一改为 Testcontainers/MySQL——由实现阶段在 `tasks.md` 中落地。
- **配置**：在 `application.properties`（及 `application-prod.example.properties` 等）中显式展示 JDBC URL、驱动、用户名、密码占位或环境变量引用；开发环境使用用户提供的本机实例：**`127.0.0.1:3306`**，库名 **`fishtank`**，用户 **`root`**，密码 **`52415241`**。
- **Hibernate 方言与特性**：使用 MySQL 方言；关闭 H2 Console 相关配置。
- **数据与迁移**：首次连接前需在 MySQL 中创建数据库 `fishtank`（及合适字符集/排序规则）；现有 H2 数据迁移策略（可选脚本或说明）在实现中明确。
- **相关文档**：部署与本地验证文档中与 H2 路径、示例配置不一致的段落需同步更新。

## Capabilities

### New Capabilities

- `skill-gateway-mysql`: 定义 skill-gateway 使用 MySQL 作为唯一运行时关系型数据源时的配置项、涉及表清单、与 JPA/Hibernate 的约束（含预迁移组件与表名元数据兼容性）。

### Modified Capabilities

- （无）现有 OpenSpec 能力描述的是业务行为（Skill、用户、台账等），不将「使用 H2」作为需求；本次为持久化引擎替换，不改变对外 API 与业务规则。

## Impact

- **代码**：`backend/skill-gateway`（`pom.xml`、`application*.properties`、`SkillTablePreMigration` 等依赖数据库方言或元数据的类）。
- **依赖**：MySQL Connector/J；H2 从默认运行时 classpath 中移除或降级作用域。
- **运维**：开发者需本地或容器提供 MySQL，并预先创建 `fishtank` 库；生产示例配置改为 MySQL 连接串与凭据管理方式。
- **安全**：仓库内若提交明文密码，仅限开发默认；生产应通过环境变量或密钥管理覆盖（在 design 中说明）。
