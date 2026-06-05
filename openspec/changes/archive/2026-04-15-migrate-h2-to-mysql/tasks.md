## 1. 依赖与驱动

- [x] 1.1 在 `backend/skill-gateway/pom.xml` 添加 `mysql-connector-j`（runtime），移除或缩小 `h2` 为 `test` scope（若测试仍用 H2）
- [x] 1.2 确认无其他模块错误传递 H2 为运行时依赖

## 2. Spring 配置

- [x] 2.1 将 `application.properties` 改为 MySQL：`spring.datasource.url`（`127.0.0.1:3306/fishtank`）、`username=root`、`password=52415241`、驱动类、`spring.jpa.database-platform` 为 MySQL 方言
- [x] 2.2 在 URL 中显式 `useUnicode`、`characterEncoding`（及项目约定的 `utf8mb4` 相关参数）
- [x] 2.3 删除 `spring.h2.console.enabled` 及 H2 特有项；保留或调整 `spring.sql.init.mode` / `spring.jpa.defer-datasource-initialization` 与 MySQL 兼容
- [x] 2.4 更新 `application-prod.example.properties` 为 MySQL 示例（占位密码或注释说明环境变量覆盖）

## 3. 代码与预迁移

- [x] 3.1 调整 `SkillTablePreMigration` 中 `getTables` 的表名探测，兼容 MySQL 对 `skills` 表的命名（见 design）
- [x] 3.2 将日志与注释中「重置 H2 文件」等表述改为与 MySQL 一致的说明

## 4. 测试与验证

- [x] 4.1 更新或新增 `src/test/resources` 中的测试数据源配置（Testcontainers MySQL、或 H2+MySQL 模式 / 嵌入式策略，与 design 选定一致）
- [x] 4.2 跑通 `backend/skill-gateway` 的 `mvn test`，修复因方言或 SQL 差异失败的用例

## 5. 文档与运维说明

- [x] 5.1 更新 `docs/mac-local-verify-deploy.md`、`docs/single-host-deploy.md` 中与 H2 路径、示例 `spring.datasource` 相关的段落
- [x] 5.2 在文档中说明：需预先 `CREATE DATABASE fishtank`（`utf8mb4`）及可选的旧 H2 数据迁移思路
