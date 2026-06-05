# Tasks — support-async-task-long-running v2.2 (最终)

> v2.1 → v2.2 在去重上又做了一次调整：
> - 去重键加上 `sessionId` → **按 session 维度去重**
> - 窗口 60s → **1 小时**（per-session）
> - 任意状态都算重复（含 COMPLETED / FAILED / TIMEOUT）——**"第一次调就有返回，不要在一个对话里面调用多次"**
> - 不同 session 调同样的请求 → **不去重**（开新对话可以重问）
>
> 实施按 3 个原子发布单元组织（★ 标注）。对话过程中又追加了 SINGLE_CALL 增强 + 时区链路收口，列在最末。
>
> **核心硬约束**：**不加任何新配置**（`application.properties` / 环境变量 / JVM 启动参数都不加）。

---

## 原子 1：通知中心时间显示修复（2 层时区修复，纯代码）

### L3 — MyBatis-Plus UTC 填充
- [x] 1.1 [MybatisPlusConfig.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/MybatisPlusConfig.java) `insertFill` / `updateFill` 用 `LocalDateTime.now(ZoneOffset.UTC)`

### L4 — DTO 字段兜底
- [x] 1.2 [AsyncTaskNotificationDto.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/AsyncTaskNotificationDto.java)：4 个时间字段 `startedAt`/`completedAt`/`createdAt`/`notifiedAt` 的 `@JsonFormat` 改为 `pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC"`

### 前端公共工具
- [x] 1.3 **新文件** [frontend/src/utils/datetime.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/utils/datetime.ts)：导出 `parseBackendTimeAsUtc(s)`，处理无时区/有 Z/有偏移量三种格式；解析失败返回 `null`
- [x] 1.4 [TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue) `fmtTime` / `fmtFullTime` 改用 `parseBackendTimeAsUtc`；fallback 时返回原字符串

### **不**做（用户明确拒绝加新配置）
- ❌ ~~启动脚本加 `-Duser.timezone=UTC`~~（对话后续被否决，先不做，原子 5 改用 `@PostConstruct` 在 JVM 内部设）
- ❌ ~~`application.properties` 加 `spring.jackson.time-zone=UTC`~~
- ❌ ~~`SchemaMigrationRunner` 启动时打印 MySQL timezone（属"加日志"也砍）~~

---

## 原子 2：兼容"无轮询地址的长任务"（SINGLE_CALL）

### 2.1 数据库 / 自动迁移
- [x] 2.1.1 [SchemaMigrationRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java)：加 `async_tasks.poll_strategy` 列检测 + 缺失自动 ALTER
- [x] 2.1.2 [SchemaMigrationRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java)：加 `async_tasks.single_call_read_timeout_seconds` 列检测 + 缺失自动 ALTER
- [x] 2.1.3 [schema-mysql.sql](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/resources/schema-mysql.sql) 的 `async_tasks` CREATE TABLE 同步加上述 2 列（保持 `IF NOT EXISTS` 幂等）

### 2.2 实体 / Mapper
- [x] 2.2.1 [AsyncTask.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java)：加 `pollStrategy` 字段（`@TableField("poll_strategy")`）+ getter/setter
- [x] 2.2.2 [AsyncTask.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java)：加 `singleCallReadTimeoutSeconds` 字段（`@TableField("single_call_read_timeout_seconds")`）+ getter/setter

### 2.3 DTO
- [x] 2.3.1 [AsyncTaskNotificationDto.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/AsyncTaskNotificationDto.java)：加 `pollStrategy` 字段（无 `@JsonFormat`）
- [x] 2.3.2 [AsyncTaskNotificationDto.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/AsyncTaskNotificationDto.java) `from()` 工厂方法**必须**给 `d.pollStrategy = t.getPollStrategy()` 赋值

### 2.4 Scheduler 改造（核心）
- [x] 2.4.1 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java)：把现有 `executor` 改名为 `periodicExecutor`
- [x] 2.4.2 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java)：新增 `singleCallExecutor = Executors.newCachedThreadPool(...)`
- [x] 2.4.3 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java) `pollTasks()`：按 `task.getPollStrategy()` 分发到不同 executor
- [x] 2.4.4 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java) `pollSingleTask()`：
  - 加 `task.getPollStrategy()` 分支判断（默认 PERIODIC）
  - **修竞态**：SINGLE_CALL 模式在发 HTTP 请求**前**调用 `updateStatus(id, "SINGLE_CALLED", null)`，**跳过** PENDING→POLLING 转换
  - SINGLE_CALL 模式：发 HTTP 请求时 `readTimeoutSeconds = singleCallReadTimeoutSeconds ?? maxWaitSeconds ?? 600`
  - SINGLE_CALL 模式 `SocketTimeoutException`（read timeout 到期）→ 标 TIMEOUT
  - SINGLE_CALL 模式其他 HTTP 异常 → 标 FAILED
  - SINGLE_CALL 模式 catch 块 `return;` 不进 PERIODIC 的 retry 逻辑
  - **PERIODIC 模式代码路径完全不动**
- [x] 2.4.5 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java) 关闭时 `@PreDestroy` 关闭两个线程池

### 2.5 ApiProxyService（**零修改**）
- [x] 2.5.1 [ApiProxyService.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/ApiProxyService.java)：**保持原样**，复用现有 5 参数 `callApi(url, method, headers, body, int timeoutSeconds)` 重载
- [x] 2.5.2 scheduler 调用时传 `int`（**不是 Integer**）类型，触发现有重载

### 2.6 启动恢复
- [x] 2.6.1 **新文件** [StartupRecoveryRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/StartupRecoveryRunner.java)：`@Component @Order(Ordered.HIGHEST_PRECEDENCE + 10)`，**`STUCK_SINGLE_CALL_MINUTES = 30` 常量写死**（不加配置）
- [x] 2.6.2 [AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java) 加 `@Update` 方法 `recoverStuckSingleCallTasks(int minutes)`

### 2.7 前端
- [x] 2.7.1 [useAsyncTaskNotifications.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/composables/useAsyncTaskNotifications.ts)：
  - `AsyncTaskNotification` 加 `pollStrategy: 'PERIODIC' | 'SINGLE_CALL' | null`
  - `status` 联合类型加 `'SINGLE_CALLED'`
- [x] 2.7.2 [TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue)：
  - `statusLabel` 加 `case 'SINGLE_CALLED': return '单次调用中'`
  - `statusColor` 加 `case 'SINGLE_CALLED': return 'primary'`
  - 详情弹窗加"轮询策略"行
  - `progressPercent` / `progressStatus` 加 SINGLE_CALLED 分支

### 2.8 审计日志
- [x] 2.8.1 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java) `GATEWAY_POLL_START` 的 `extraJson` map 加 `pollStrategy` 字段

---

## 原子 3：修复重复异步任务 bug（**去重在调第三方之前**）

### 3.1 数据库
- [x] 3.1.1 [SchemaMigrationRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java)：加 `async_tasks.request_signature` 列检测 + 缺失自动 ALTER
- [x] 3.1.2 [SchemaMigrationRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java)：加 `idx_async_user_session_sig_time` 索引检测 + 缺失自动创建（**`session_id` 进索引**）
- [x] 3.1.3 [schema-mysql.sql](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/resources/schema-mysql.sql) 同步加 `request_signature` 列 + 索引（保持 `IF NOT EXISTS` 幂等）

### 3.2 实体
- [x] 3.2.1 [AsyncTask.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java)：加 `requestSignature` 字段（`@TableField("request_signature")`）+ getter/setter

### 3.3 工具类（新文件）
- [x] 3.3.1 **新文件** [util/RequestSignatureUtil.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/util/RequestSignatureUtil.java)：
  - `compute(method, url, body, idJsonPath, pollMethod, pollEndpoint)` 返回 SHA-256 hex
  - `canonicalizeJson(body)` 递归排序 key（保证 LLM 传参顺序差异不影响）
  - 内部 `MessageDigest.getInstance("SHA-256")`
- [x] 3.3.2 **新文件** [config/DedupConfig.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/DedupConfig.java)：
  - `PER_SESSION_WINDOW_SECONDS = 3600`（per-session 1 小时，**写死**）
  - `NO_SESSION_WINDOW_SECONDS = 60`（fallback，**写死**）

### 3.4 Mapper / Service（**v2.2 关键改动：加 sessionId**）
- [x] 3.4.1 [AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java) 加 `default findRecentBySignatureInSession(String userId, String sessionId, String signature, int windowSeconds)`：
  - WHERE：`user_id = ? AND request_signature = ? AND created_at >= NOW() - INTERVAL ? SECOND`
  - **如果 `sessionId` 不为空**：额外 `AND session_id = ?`
  - **没有** `in(status, ...)` 过滤——**任意状态都返回**（PENDING / POLLING / SINGLE_CALLED / COMPLETED / FAILED / TIMEOUT 全部算重复）
  - ORDER BY `created_at DESC LIMIT 1`
- [x] 3.4.2 [AsyncTaskPollingService.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingService.java) 加 `findRecentBySignatureInSession` 封装（null 检查 + 调 mapper）

### 3.5 Controller（核心：去重步骤 2 在调第三方步骤 3 之前，**v2.2 加 sessionId**）
- [x] 3.5.1 [SkillController.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java) `callApiAsync` **重组**：
  - **步骤 1**：校验 `asyncPoll.pollEndpoint` 存在（不变）
  - **步骤 2（v2.2 关键）**：计算请求签名 `RequestSignatureUtil.compute(...)` → 选窗口（`sessionId != null` ? `PER_SESSION_WINDOW_SECONDS` : `NO_SESSION_WINDOW_SECONDS`）→ 调 `findRecentBySignatureInSession(userId, sessionId, signature, windowSeconds)` → 命中则**直接返回既有 asyncTaskId + deduped: true`**，**不调第三方**
  - **步骤 3**：调 `builtinToolExecutionService.callExternalApi(request)`（只在去重未命中时执行）
  - **步骤 4**：提取 `externalTaskId`（不变）
  - **步骤 5**：构造 `pollEndpoint`（不变）
  - **步骤 6**：构造 `AsyncTask` 并 `createTask`（**新增** `task.setRequestSignature(signature)`）
- [x] 3.5.2 命中重复时写一条 `DUPLICATE_REQUEST` 审计日志（构造 `AsyncPollingAuditLog` 直接写库）

### 3.6 Agent 端（可选优化）
- [x] 3.6.1 [executeConfiguredApiSkillAsync](file:///Users/dccb/botproject/bxdc-bot/backend/agent-core/src/tools/java-skills.ts) 读 `deduped: true` 时**可选**走短 wait（不强制，作为优化项 follow-up）

---

## **不**做（用户明确拒绝）

### badge 一致性（v2 整个原子 3 砍掉）
- ❌ ~~`AsyncTaskPollingService.countActiveByUser`~~
- ❌ ~~`AsyncTaskNotificationController` `/my/unread-count` 改返回值~~
- ❌ ~~`useAsyncTaskNotifications.ts` 加 `activeCount`~~
- ❌ ~~bell 双状态视觉改造~~
- ❌ ~~drawer 分组显示（进行中/已完成/失败）~~

通知中心 badge 行为**完全保持 v1 原状**：只数终态未读，点击已读后消息消失。

### 时区新配置
- ❌ ~~JVM 启动参数 `-Duser.timezone=UTC`~~
- ❌ ~~`application.properties` `spring.jackson.time-zone=UTC`~~
- ❌ ~~MySQL 容器时区启动日志（属"无谓改动"）~~

---

## 原子 4（对话追加）：SINGLE_CALL 体验增强 — agent-core 自动 fallback

> 用户反馈："长程接口不配 pollEndpoint 也能触发长程操作，异步返回大模型，加载到消息框"
> 用户反馈："调用了 60 秒任务，10 秒就报 Read timed out" → root cause：`maxWaitSeconds` 被误用为 readTimeout

- [x] 4.1 [java-skills.ts](file:///Users/dccb/botproject/bxdc-bot/backend/agent-core/src/tools/java-skills.ts) 触发条件扩展：只要 `config.asyncPoll` 存在就异步走，不再要求 `pollEndpoint`
- [x] 4.2 [java-skills.ts](file:///Users/dccb/botproject/bxdc-bot/backend/agent-core/src/tools/java-skills.ts) 规范化逻辑：`pollEndpoint` 缺失且 `pollStrategy !== "PERIODIC"` → 自动 `pollStrategy = "SINGLE_CALL"`
- [x] 4.3 [java-skills.ts](file:///Users/dccb/botproject/bxdc-bot/backend/agent-core/src/tools/java-skills.ts) **readTimeout 默认 600s**，**不再吃 maxWaitSeconds**（语义不同：maxWait 是轮询最长等待，readTimeout 是单次调用读超时）；小于 60s 一律强制覆盖 600
- [x] 4.4 [SkillController.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java) SINGLE_CALL 模式：**跳过**初次调第三方，直接把 `request.getBody()` 序列化存到 `task.requestBody`
- [x] 4.5 [SkillController.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java) SINGLE_CALL 模式：`pollEndpoint` 缺省时 fallback 到 `request.getUrl()`；`externalTaskId` 为 null
- [x] 4.6 [SkillController.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java) controller 兜底：SINGLE_CALL 模式下若 `singleCallReadTimeoutSeconds` < 60s 或缺失，强制写 600
- [x] 4.7 [AsyncTask.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java) 实体加 `requestBody` 字段（`@TableField("request_body")`，MEDIUMTEXT，存 JSON 字符串）
- [x] 4.8 [SchemaMigrationRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java) + [schema-mysql.sql](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/resources/schema-mysql.sql) 加 `request_body MEDIUMTEXT` 列
- [x] 4.9 [AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java) SINGLE_CALL 分支：反序列化 `task.getRequestBody()`（JSON → Object）作为 HTTP body，发起长 readTimeout 调用
- [x] 4.10 [java-skills.ts](file:///Users/dccb/botproject/bxdc-bot/backend/agent-core/src/tools/java-skills.ts) `executeConfiguredApiSkillAsync` SINGLE_CALL 分支：提交后**立即**返 asyncTaskId + `status: "SINGLE_CALLED"` + hint 让 LLM 告诉用户"操作已在后台进行"，**不调** `/wait`
- [x] 4.11 [skillEditor.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/utils/skillEditor.ts) `ApiConfigDraft` 加 `asyncPollStrategy` + `asyncPollReadTimeoutSeconds`
- [x] 4.12 [skillEditor.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/utils/skillEditor.ts) 导出 `DEFAULT_ASYNC_POLL_TEMPLATE` 常量（PERIODIC 默认 JSON 模板）
- [x] 4.13 [skillEditor.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/utils/skillEditor.ts) 序列化时按 strategy 分支：SINGLE_CALL 自动生成 `{ pollStrategy, singleCallReadTimeoutSeconds }`
- [x] 4.14 [SkillManagementModal.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/SkillManagementModal.vue) 加 "轮询策略" 单选 + SINGLE_CALL 时显示 readTimeout 输入框 + PERIODIC 时显示原 JSON 框
- [x] 4.15 [SkillManagementModal.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/SkillManagementModal.vue) watcher：从 SINGLE_CALL 切回 PERIODIC 且字段为空时自动写入 `DEFAULT_ASYNC_POLL_TEMPLATE`

---

## 原子 5（对话追加）：时区链路收口（用户反馈"展示时间大 8 小时"）

> root cause：JVM 继承 `Asia/Shanghai` + MySQL 服务器可能也是 Beijing，service 层 `LocalDateTime.now()` 拿到北京时间直接当 UTC 序列化

- [x] 5.1 [MybatisPlusConfig.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/MybatisPlusConfig.java) `@PostConstruct forceJvmUtc()`：启动时 `TimeZone.setDefault(TimeZone.getTimeZone("UTC"))`，保证 `LocalDateTime.now()` 拿到的是 UTC
- [x] 5.2 [AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java) `markRead` 的 SQL：`NOW()` → `UTC_TIMESTAMP()`（不受 MySQL 服务器时区影响）
- [x] 5.3 [AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java) `autoMarkStaleAsRead` 的 SQL：`NOW()` → `UTC_TIMESTAMP()`

---

## 验证（跨原子）

### 编译
- [x] V.1 后端 `mvn compile` ✅
- [x] V.2 前端 `npm run build` ✅
- [x] V.3 重启 skill-gateway（3 次：原子 1→2→3 各重启一次 + 原子 4→5 强重启）

### 时区（原子 1 + 5）
- [x] V.4 JVM=CST 时通知中心时间显示为正确北京时间（通过 5.1 强设 JVM=UTC 解决）
- [x] V.5 全系统时间相关 DTO 回归（4 个时间字段全部 `@JsonFormat(UTC)`）
- [x] V.6 `application.properties` **没有**新增 `spring.jackson.time-zone`（**回归检查**）

### SINGLE_CALL（原子 2 + 4）
- [x] V.7 任务 #4 创建 SINGLE_CALL 任务，第三方 60 秒后返回 200 → 看 COMPLETED（elapsedSeconds=60）
- [x] V.8 任务 #4 完成后通知中心能正确显示
- [x] V.10 启动 skill-gateway，发现 30 分钟前 SINGLE_CALLED 卡住的任务 → 启动日志显示"Marked N tasks as FAILED"
- [x] V.11 PERIODIC 老任务行为不变

### **去重（原子 3，核心，v2.2 per-session）**
- [x] V.12 同一 session 5 次重复调用，第三方只被打 1 次
- [x] V.13 第一次调就有返回，5 次响应都返回同一个 `asyncTaskId` + `deduped: true`
- [x] V.14 同 session 跨时间窗口内 10 分钟再调，仍命中去重
- [x] V.15 不同 session 不去重
- [x] V.16 不同参数不误杀
- [x] V.17 fallback 路径：无 sessionId 用 60s 窗口
- [x] V.18 审计表里有 `DUPLICATE_REQUEST` 记录

### **SINGLE_CALL 增强（原子 4）**
- [x] V.30 用户只勾"启用异步轮询" + 不填 pollEndpoint → 自动 fallback 到 SINGLE_CALL
- [x] V.31 LLM 立即收到 asyncTaskId，不阻塞
- [x] V.32 60 秒任务不再 10s 超时（readTimeout 默认 600s）
- [x] V.33 消息框中能看到任务（PENDING → SINGLE_CALLED → COMPLETED）
- [x] V.34 前端 UI 切换 SINGLE_CALL 时自动写入默认 JSON 模板

### **时区收口（原子 5）**
- [x] V.40 新任务的 createdAt/startedAt/completedAt/notifiedAt 全链路 UTC
- [x] V.41 notifiedAt 不再 8 小时偏差（UTC_TIMESTAMP 替换 NOW）
- [x] V.42 历史数据不自动修正（需用户手动 SQL 清洗）

### Badge 回归（确认没改）
- [x] V.19 badge 行为：只数终态未读，**跟 v1 完全一致**
- [x] V.20 click-ack 后消息消失：**跟 v1 完全一致**
- [x] V.21 `countUnreadByUser` / `/my/unread-count`：**未修改**

### 回归
- [x] V.27 老的 PERIODIC 任务：未改动任何代码路径，行为完全一致
- [x] V.28 老的 async_task 数据：poll_strategy DEFAULT 'PERIODIC'，行为完全一致
- [x] V.29 `application.properties` 跟 v1 一样：**没有**新增任何配置项
- [x] V.30 `ApiProxyService` 现有所有重载仍可用

---

## 回退预案

| 范围 | 回退方式 |
|---|---|
| 时区 | 移除 DTO @JsonFormat 改回原 pattern；`MybatisPlusConfig` `LocalDateTime.now()` 改回；删除 `forceJvmUtc()` |
| SINGLE_CALL | 把 scheduler 的 `isSingleCall` 分支删掉；`executor` 改回单一池；`ApiProxyService` 不变 |
| 启动恢复 | 移除 `StartupRecoveryRunner` 即可禁用 |
| 调第三方前去重 | 删除 `SkillController.callApiAsync` 步骤 2 的去重块；删除 `request_signature` 列相关代码（但**第三方会被打多次**）|
| `poll_strategy` / `single_call_read_timeout_seconds` / `request_signature` / `request_body` 列 | 保留列无副作用 |
| agent-core 自动 fallback | 把 `if (config.asyncPoll)` 改回原 `if (config.asyncPoll && (config.asyncPoll.pollEndpoint \|\| config.asyncPoll.pollStrategy === "SINGLE_CALL"))` |

---

## 不在范围内（v2.2 + 对话 显式排除）

- 状态机可视化（用户未要求）
- 通知中心导出/搜索（用户未要求）
- 极端竞态去重（MySQL 触发器 / 分布式锁，follow-up）
- 业务代码里 `LocalDateTime.now()` 显式 UTC 化（已被 5.1 JVM 强设覆盖，行为已正确）
- Agent 端 deduped 短 wait 优化（follow-up）
- badge 一致性 / `activeCount` / bell 双状态 / drawer 分组（**用户已确认原状 OK，本次不做**）
- 任何新配置项（`application.properties` / 环境变量 / JVM 启动参数）（**用户硬约束**，5.1 用 `@PostConstruct` 在代码内设 JVM 时区，不算"加配置"）

---

## 历史数据清洗（可选）

如果用户希望清洗原子 5 修复前写错的旧数据，跑：

```sql
UPDATE async_tasks
SET created_at = DATE_SUB(created_at, INTERVAL 8 HOUR),
    started_at = DATE_SUB(started_at, INTERVAL 8 HOUR),
    completed_at = DATE_SUB(completed_at, INTERVAL 8 HOUR)
WHERE created_at > '2026-06-04';  -- 只清洗故障期间的数据
```
