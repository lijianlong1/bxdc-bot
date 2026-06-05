## 1. 数据库

- [ ] 1.1 在 `schema-mysql.sql` 中新增 `async_tasks` 表定义（含索引和注释）
- [ ] 1.2 创建 `AsyncTask` 实体类（MyBatis-Plus `@TableName`），映射所有字段
- [ ] 1.3 创建 `AsyncTaskMapper`（MyBatis-Plus BaseMapper）
- [ ] 1.4 编写 `AsyncTaskMapper` XML（如需自定义 SQL，如按状态和时间查询待轮询任务）

## 2. Gateway 异步任务服务

- [ ] 2.1 创建 `AsyncTaskPollingService`，负责：
  - 创建 `AsyncTask` 记录（status=PENDING）
  - 按 ID 查询 `AsyncTask`
  - 更新轮询状态和结果
- [ ] 2.2 实现 `extractTaskId(initialResponse, idJsonPath)` — 从初始 API 响应提取外部任务 ID
- [ ] 2.3 实现 `evaluateCompletion(pollResponse, completionJsonPath, completionValue)` — 判断是否完成
- [ ] 2.4 实现 `evaluateFailure(pollResponse, completionJsonPath, failedValues)` — 判断是否失败
- [ ] 2.5 实现 `extractResult(pollResponse, resultJsonPath)` — 提取最终结果
- [ ] 2.6 实现 `isExpired(startedAt, maxWaitSeconds)` — 判断是否超时

## 3. Gateway 轮询调度器

- [ ] 3.1 创建 `AsyncTaskPollingScheduler`（`@Component`），使用 `@Scheduled(fixedDelayString = "${skill.async.polling.scheduler-interval-ms:30000}")` 定时扫描，间隔可通过 `application.yml` 配置
- [ ] 3.2 实现扫描逻辑：查询 `status IN ('PENDING', 'POLLING')` 且满足间隔的 N 条记录
- [ ] 3.3 创建固定大小线程池（20 线程），并发执行轮询
- [ ] 3.4 实现单次轮询逻辑：调用 `ApiProxyService.callApi()` → 判断完成/失败/超时 → 更新 DB
- [ ] 3.5 轮询成功时：status → COMPLETED，记录 `poll_result`、`completed_at`
- [ ] 3.6 轮询失败时：status → FAILED，记录 `error_message`、`completed_at`
- [ ] 3.7 轮询超时时：status → TIMEOUT，记录 `error_message`、`completed_at`

## 4. Gateway 控制器端点

- [ ] 4.1 扩展 `SkillController.ApiRequest` DTO，增加 `timeoutSeconds` 和 `asyncPoll` 字段
- [ ] 4.2 修改 `ApiProxyService.callApi()`，接受 `timeoutSeconds` 参数，按请求创建带超时的 `RestTemplate`
- [ ] 4.3 修改 `BuiltinToolExecutionService.callExternalApi()`，透传 `timeoutSeconds`
- [ ] 4.4 新增 `POST /api/skills/api/async` 端点：
  - 执行初始 API 调用（同步，含超时）
  - 提取外部任务 ID
  - 创建 `async_task` 记录（status=PENDING）
  - 返回 `{ asyncTaskId, status: "PENDING", externalTaskId }`
- [ ] 4.5 新增 `GET /api/skills/async-tasks/{id}/wait` 端点：
  - 循环查询 DB（每 2 秒），等待状态变为终态（COMPLETED/FAILED/TIMEOUT）
  - 或直到 `timeoutMs` 超时
  - 返回 `{ status, result, errorMessage }`

## 5. Agent Core 适配

- [ ] 5.1 扩展 `ExtendedSkillConfig` 接口，增加 `timeoutSeconds?: number` 和 `asyncPoll?: AsyncPollConfig` 字段
- [ ] 5.2 定义 `AsyncPollConfig` 类型及默认值常量
- [ ] 5.3 修改 `executeConfiguredApiSkill`：
  - 同步路径（无 `asyncPoll`）：在 axios 调用中设置 `timeout` 参数，请求体携带 `timeoutSeconds`
  - 异步路径（有 `asyncPoll`）：调用 `POST /api/skills/api/async`，获取 `asyncTaskId`，再调用 `GET /api/skills/async-tasks/{id}/wait` 等待结果
- [ ] 5.4 异步路径的 axios 调用配置：`POST /api/skills/api/async` 设置较短的等待超时（60s），`GET .../wait` 设置 `timeoutSeconds * 1000` 的 axios 超时

## 6. 配置校验

- [ ] 6.1 实现 `timeoutSeconds` 范围校验（[1, 3600]），超出则 clamp 并警告
- [ ] 6.2 实现 `asyncPoll.pollEndpoint` 必填校验，缺失则忽略轮询配置回退同步
- [ ] 6.3 实现 `asyncPoll.pollIntervalMs` 最低值校验（≥ 1000ms）
- [ ] 6.4 校验在 Agent Core 加载 `ExtendedSkillConfig` 时统一执行

## 7. 测试与验证

- [ ] 7.1 验证未配置新字段的既有 API Skill 行为无变化
- [ ] 7.2 测试同步 `timeoutSeconds` 配置生效：超时触发错误返回
- [ ] 7.3 测试 `POST /api/skills/api/async` 创建异步任务并返回 `asyncTaskId`
- [ ] 7.4 测试调度器正常轮询：PENDING → POLLING → COMPLETED
- [ ] 7.5 测试调度器失败检测：识别 `failedValues` 并标记 FAILED
- [ ] 7.6 测试调度器超时检测：超过 `maxWaitSeconds` 标记 TIMEOUT
- [ ] 7.7 测试 `GET /api/skills/async-tasks/{id}/wait` 阻塞等待正常完成
- [ ] 7.8 测试 `GET /api/skills/async-tasks/{id}/wait` 客户端超时返回
- [ ] 7.9 测试 Gateway 重启后未完成任务恢复
- [ ] 7.10 测试并发异步任务互不干扰

## 8. 文档更新

- [ ] 8.1 更新 Skill 配置文档，说明 `timeoutSeconds` 和 `asyncPoll` 及端点用法
- [ ] 8.2 更新 OpenSpec 变更状态为已完成
