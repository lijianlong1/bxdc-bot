## 1. 新增实体类（JPA 注解）

- [ ] 1.1 创建 `entity/AsyncTask.java` — 使用 `@Entity` + `@Table(name = "async_tasks")` + `@Id` + `@GeneratedValue(strategy = GenerationType.IDENTITY)` + `@Column` 注解，与 `low-version` 字段完全一致
- [ ] 1.2 创建 `entity/SkillTextPrompt.java` — 使用 JPA 注解，字段与 `low-version` 完全一致

## 2. 新增 Repository 接口（JpaRepository）

- [ ] 2.1 创建 `repository/AsyncTaskRepository.java` — 继承 `JpaRepository<AsyncTask, Long>`，含：
  - `findByStatusIn(List<String> statuses)`
  - `@Query findPendingOrPolling(Pageable pageable)` — JPQL 实现"状态为 PENDING/POLLING 且到达轮询间隔"查询
- [ ] 2.2 创建 `repository/SkillTextPromptRepository.java` — 继承 `JpaRepository<SkillTextPrompt, Long>`，含：
  - `findByFieldId(String fieldId)`

## 3. 新增 Service 类（JPA 数据访问）

- [ ] 3.1 创建 `service/AsyncTaskPollingService.java` — 网络：
  - 注入 `AsyncTaskRepository`（非 `AsyncTaskMapper`）
  - `findPendingOrPollingTasks(int limit)`：调 `asyncTaskRepository.findPendingOrPolling(PageRequest.of(0, limit))`
  - `findById(Long id)`：`asyncTaskRepository.findById(id).orElse(null)`
  - `updateStatus(Long id, String status, String errorMessage)`：先 `findById` → 设置字段 → `save`
  - `updateStatusAndLastPolled(Long id, String status)`：同上
  - `updateLastPolled(Long id)`：先 `findById` → `setLastPolledAt` + `setPollRetryCount(0)` → `save`
  - `incrementRetryCount(Long id)`：先 `findById` → `pollRetryCount+1` → `save`
  - `updatePollResult(Long id, String status, String result, String errorMessage)`：同上
  - `extractTaskId`、`evaluateCompletion`、`evaluateFailure`、`extractResult`、`isExpired`、`extractByPath`、`extractValueByPath`：业务逻辑完全复制 low-version
- [ ] 3.2 创建 `service/AsyncTaskPollingScheduler.java` — 网络：
  - 注入 `AsyncTaskPollingService` + `ApiProxyService`
  - `@Scheduled(fixedDelayString = "${async.polling.interval-ms:30000}")`
  - `pollTasks()` + `pollSingleTask()` 逻辑完全复制 low-version
  - 连续失败 ≥ 3 次标记 FAILED（与 low-version 一致）

## 4. 修改现有 Controller — SkillController

- [ ] 4.1 网络 `import`：新增 `AsyncTask`、`AsyncTaskPollingService`、`SkillTextPrompt`、`SkillTextPromptRepository`（非 Mapper）
- [ ] 4.2 构造器注入 `AsyncTaskPollingService` 和 `SkillTextPromptRepository`
- [ ] 4.3 新增 `POST /api/skills/api/async` 端点 — 复制 low-version 逻辑（初始调用 + 提取 task_id + 创建 AsyncTask + 写入 DB）
- [ ] 4.4 新增 `GET /api/skills/async-tasks/{id}/wait` 端点 — 复制 low-version 逻辑（轮询 DB 等待 COMPLETED/FAILED/TIMEOUT）
- [ ] 4.5 新增文本提示词 CRUD 端点：
  - `GET /api/skills/text-prompts` — `skillTextPromptRepository.findAll()`
  - `GET /api/skills/text-prompts/{fieldId}` — `skillTextPromptRepository.findByFieldId(fieldId)`
  - `PUT /api/skills/text-prompts/{fieldId}` — `findByFieldId` → 更新 → `save`

## 5. 修改现有 Controller — UserController

- [ ] 5.1 新增 `POST /api/user/{id}/optimize-text` 端点
- [ ] 5.2 无需前置 Key 检查（与最终的 low-version 一致，Agent Core 自检）
- [ ] 5.3 调用 `userService.proxyTextOptimize(id, body)` 转发至 Agent Core

## 6. 修改现有 Service — UserService

- [ ] 6.1 新增 `proxyTextOptimize(String userId, Map<String, Object> payload)` 方法
- [ ] 6.2 逻辑：`userLlmOverridesFromDb` 仅传用户 DB 配置（不 merge env），通过 `putIfAbsent` 传给 Agent Core
- [ ] 6.3 添加请求/响应耗时日志

## 7. 修改现有 Service — ApiProxyService

- [ ] 7.1 新增 `callApi(url, method, headers, body, int timeoutSeconds)` 重载方法
- [ ] 7.2 在网络层创建带 timeout 的 `RestTemplate`（与 low-version 一致的 SimpleClientHttpRequestFactory 方式）

## 8. 修改现有 Service — BuiltinToolExecutionService

- [ ] 8.1 新增异步 API 调用路径：检测 `request.getAsyncPoll() != null` → 走异步流程
- [ ] 8.2 提取 task_id → 创建 AsyncTask → 返回 asyncTaskId

## 9. 修改配置类

- [ ] 9.1 `SecurityConfig.java`：在 `authorizeHttpRequests` 中新增两条 `permitAll` 规则（`async-tasks/*/wait`、`text-prompts/**`）
- [ ] 9.2 `SkillGatewayApplication.java`：添加 `@EnableScheduling` 注解

## 10. 数据库 DDL

- [ ] 10.1 在 `schema-mysql.sql` 尾部追加 `async_tasks` 表定义（含 `poll_retry_count` 列）
- [ ] 10.2 追加 `skill_text_prompts` 表定义

## 11. 编译验证

- [ ] 11.1 `mvn compile` 无错误
- [ ] 11.2 检查所有 import 为 `jakarta.persistence.*`（非 `javax.persistence.*`）
- [ ] 11.3 检查无 MyBatis-Plus 残留 import
