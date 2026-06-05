## Why

`low-version` 分支已经完成了以下业务功能开发，但 `prop` 分支（生产部署分支）尚未合入：

1. **API Skill 异步轮询** — 长时间运行 API 的数据库持久化轮询机制
2. **AI 文本智能优化** — Skill 编辑表单 9 个文本框的 LLM 辅助优化
3. **formBody 数组支持** — `parameterBinding: formBody` 的数组参数通过重复 key 编码
4. **SKILL GENERATOR 增强** — `timeoutSeconds`、`asyncPoll`、`parameterBinding` 字段

两个分支的 **Gateway Java 端技术栈不同**：

| 维度 | prop | low-version |
|------|------|-------------|
| Spring Boot | 3.2.3 | 2.7.3 |
| Java | 17 | 8 |
| ORM | Spring Data JPA | MyBatis-Plus |
| HTTP Client | Apache HttpClient5 | Apache HttpClient4 |
| Entity 注解 | `jakarta.persistence.*` | `com.baomidou.mybatisplus.annotation.*` |

本次变更仅将**业务逻辑代码**迁移至 prop 分支，**不改变 prop 的任何依赖版本或 ORM 框架**。

## What Changes

### Gateway Java 端 — 新增文件（适配 JPA）

| 新增文件 | 说明 | 适配点 |
|----------|------|--------|
| `entity/AsyncTask.java` | 异步任务实体 | `@Entity` + `@Table(name = "async_tasks")` 替代 `@TableName`；`@Id` + `@GeneratedValue` 替代 `@TableId`；`@Column` 替代 `@TableField` |
| `entity/SkillTextPrompt.java` | 文本提示词实体 | 同上 |
| `repository/AsyncTaskRepository.java` | 异步任务 Repository | 继承 `JpaRepository<AsyncTask, Long>`，自定义查询方法替代 MyBatis Mapper xml/default 方法 |
| `repository/SkillTextPromptRepository.java` | 提示词 Repository | 继承 `JpaRepository<SkillTextPrompt, Long>` + `findByFieldId` |
| `service/AsyncTaskPollingService.java` | 轮询业务服务 | 注入 `AsyncTaskRepository` 替代 `AsyncTaskMapper`；构造 QueryWrapper 查询改为 JPQL/Specification |
| `service/AsyncTaskPollingScheduler.java` | 定时轮询调度器 | 同上 |

### Gateway Java 端 — 修改文件（合并业务代码）

| 修改文件 | 新增内容 | 不改变 |
|----------|---------|--------|
| `controller/SkillController.java` | 异步 API 调用端点（`POST /async`、`GET /async-tasks/{id}/wait`）；文本提示词 CRUD 端点；asyncPoll `{id}` 占位校验 | 现有 CRUD 逻辑、依赖注入方式 |
| `controller/UserController.java` | `POST /{id}/optimize-text` 端点 | 现有头像、注册逻辑 |
| `service/UserService.java` | `proxyTextOptimize()` 方法 | 现有方法签名、UserRepository 引用 |
| `service/ApiProxyService.java` | `callApi` 重载方法（含 `timeoutSeconds` 参数） | 现有 `callApi` 方法签名 |
| `service/BuiltinToolExecutionService.java` | 异步 API 调用路径分支（检测 `asyncPoll` → 走异步流程） | 现有同步调用逻辑 |
| `config/SecurityConfig.java` | 放通 `/async-tasks/*/wait`、`/text-prompts/**` GET 端点 | `authorizeHttpRequests`（prop 语法）保持不动 |
| `resources/schema-mysql.sql` | 新增 `async_tasks` 表、`poll_retry_count` 列、`skill_text_prompts` 表 | 现有表定义 |
| `SkillGatewayApplication.java` | `@EnableScheduling` 注解 | 现有注解 |

### 不修改的文件

- `pom.xml` — 依赖版本保持 prop 不变
- 所有已存在的 `entity/*.java` — 注解保持 JPA
- 所有已存在的 `service/*.java`（除以上列出的） — 逻辑不变
- `agent-core` 下所有文件 — prop 已是最新（TypeScript 无降级差异）
- `frontend` 下所有文件 — prop 已是最新

## Capabilities

### New Capabilities
无新增能力（业务能力已在 low-version 验证，本次仅做技术栈适配）

### Modified Capabilities
无现有能力变更

## Impact

**受影响代码**（仅 Gateway Java 端）：
- 新增 6 个文件（entity × 2、repository × 2、service × 2）
- 修改 6 个文件（controller × 2、service × 3、config × 1）
- 修改 1 个 DDL 文件
- 修改 1 个启动类

**数据库变更**：与 low-version 完全一致，需要执行 `docs/deploy-ddl/` 下 3 个 DDL 文件

**Agent Core / 前端**：无需变更（prop 已包含最新代码）

**部署注意**：打包的 JAR 直接替换 `low-version` 的 JAR 即可运行，无需更换 Docker 基础镜像
