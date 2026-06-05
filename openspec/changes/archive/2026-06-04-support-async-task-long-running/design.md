# support-async-task-long-running — v2.2 重设计

> v1 → v2 修复了 review 提出的 5 个致命问题 + 新增启动恢复。
>
> **v2.1**（用户反馈后再调整）：
> - **砍掉原子 3（badge 一致性）**：用户确认"原先的消息条数展示的逻辑没有问题，点击已读后消息就没有了"——badge 维持原状。
> - **砍掉 L1 / L2 时区配置**：用户说"你不要新增参数配置给我，你改代码实现就行"——L3/L4 改代码足够。
> - **去重必须放在调第三方之前**：用户反馈"agent 一直在调用，会把人家服务搞坏"——v2 的去重在调完第三方后才做，**来不及**。v2.1 用**请求签名 hash** 在**最前面**就拦截重复请求，**不打第三方**。
>
> **v2.2**（用户再反馈"如果第一次调就有返回，不要在一个对话里面调用多次"）：
> - v2.1 用 `(userId, requestSignature)` + 60s 窗口——LLM 在同一对话里 > 60s 再调一次 → 窗口过期 → 第三方被打第二次
> - v2.2 改为**按 session 维度去重**：去重键加 `sessionId`；窗口 60s → **1 小时**；**任意状态**（含 COMPLETED / FAILED / TIMEOUT）都算重复
> - 不同 session 调同样的请求 → **不去重**（开新对话可以重问）

---

## 0. 设计总览

| 范围 | 关键变化 |
|---|---|
| 1. 时间显示 | **2 层时区修复**（MyBatis-Plus UTC 填充 + DTO @JsonFormat），**不加任何新配置** |
| 2. SINGLE_CALL | **独立线程池** + **启动恢复** + **修竞态** + 新增 `single_call_read_timeout_seconds` 列 |
| 3. 重复任务去重 | **按 session 维度**：`(user, sessionId, requestSignature)` 1 小时内任意状态都去重，**在调第三方之前**直接拦截，**不打第三方** |

不变量：
- PERIODIC 老路径**一行不改**。
- 老数据 `poll_strategy` 默认 `PERIODIC`。
- 老 `ApiProxyService` 重载**全部保留**，不引入签名冲突。
- 老 `SkillController.callApiAsync` 接口**返回值/响应字段不变**；重复请求返回既有 `asyncTaskId` + 新增可选字段 `deduped: true`。
- **不加任何新的 `application.properties` / 环境变量 / JVM 启动参数**。
- 通知中心 badge 逻辑**完全不变**（用户已确认原状 OK）。

---

## 1. 通知中心时间显示修复

### 1.1 设计要点：2 层时区修复（不改任何配置）

v1 只改 DTO 字段上的 `@JsonFormat`，**假设 JVM/MySQL/JDBC 时区链路已经对齐**——这个假设没人验证。
v2 加了 4 层防御，但其中 2 层是改 `application.properties` 加新配置——**用户不接受**。
v2.1：**只用代码改动**，靠 2 层来强制对齐。

| 层 | 作用 | 代码改动 |
|---|---|---|
| L3 | MyBatis-Plus 自动填充显式写 UTC | `MybatisPlusConfig.metaObjectHandler` 用 `LocalDateTime.now(ZoneOffset.UTC)` |
| L4 | DTO 字段显式 UTC + Z 后缀 | `@JsonFormat(pattern=..., timezone="UTC")` |

**为什么 L3 + L4 就够了？**

- 写入侧：`LocalDateTime.now(ZoneOffset.UTC)` 不依赖 JVM 时区——JVM 跑 CST 也能拿到 UTC 时间。配合现有 `serverTimezone=UTC` JDBC 参数，DB 存的字面值就是"按 UTC 解释后的时刻"。
- 序列化侧：`@JsonFormat(timezone="UTC")` 告诉 Jackson 把 LocalDateTime 字面值**当作 UTC** 输出。
- 读出侧：JDBC 读 DATETIME（无时区列）→ LocalDateTime 字面值，跟写入一致。
- **全链路语义自洽**：DB LocalDateTime 字面值 ≡ UTC 时刻。

**已知遗留**（接受，不在本次范围）：
- 业务代码里直接调 `LocalDateTime.now()` 的地方（如 `updateStatus` / `updateStartedAt`）没改。L3 只覆盖 MyBatis-Plus 自动填充路径。如果哪天某条审计发现时间错乱，**逐处改**。用户已接受。

### 1.2 后端改动

#### L3：MybatisPlusConfig

[MybatisPlusConfig.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/MybatisPlusConfig.java#L18-L25) 把：

```java
LocalDateTime now = LocalDateTime.now();
```

改为：

```java
LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
```

`insertFill` 和 `updateFill` 都改。

#### L4：DTO @JsonFormat

[AsyncTaskNotificationDto.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/AsyncTaskNotificationDto.java) 4 个时间字段改为：

```java
@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
private LocalDateTime startedAt;
@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
private LocalDateTime completedAt;
@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
private LocalDateTime createdAt;
@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
private LocalDateTime notifiedAt;
```

### 1.3 前端 parseBackendTimeAsUtc（移到公共工具）

v1 把工具函数放在 [TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue) 里。**其它组件（聊天历史、skill 列表、审计详情）大概率有同样的时区问题**，应该提到公共模块。

**新文件**：[frontend/src/utils/datetime.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/utils/datetime.ts)

```typescript
/**
 * 把后端返回的时间字符串规范化为带时区的 ISO 8601 字符串。
 * - 已带 Z 或 ±HH:MM 后缀 → 原样
 * - 无时区（LocalDateTime 序列化的 "yyyy-MM-ddTHH:mm:ss"）→ 加 Z 视为 UTC
 * - 用空格分隔的 "yyyy-MM-dd HH:mm:ss" → 替换为 T 后再加 Z
 * - 解析失败返回 null，调用方决定 fallback
 */
export function parseBackendTimeAsUtc(s: string | null | undefined): Date | null {
  if (!s) return null
  let iso = s.trim()
  if (!iso) return null
  if (!iso.includes('T')) iso = iso.replace(' ', 'T')
  const hasTz = iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso)
  if (!hasTz) iso += 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}
```

[TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue) 改为 import + 使用。**fallback 行为**：解析失败时 `fmtTime`/`fmtFullTime` 返回原字符串（不抛、不破 UI）。

### 1.4 MySQL 容器时区

本次**不在启动时加日志**（避免无谓改动），但 MySQL 容器时区应在部署时**显式设为 UTC**（`docker-compose.yml` 的 MySQL service 加 `TZ=UTC` 或命令行 `--default-time-zone=+00:00`）——这是运维规范，不写进代码。

---

## 2. 兼容"无轮询地址的长任务"（SINGLE_CALL）

### 2.1 架构

#### PERIODIC（不变）
```
T=0    async_task 创建（PENDING）
T=0    scheduler：PENDING → POLLING → POST poll_endpoint → 拿响应 → 评估
T=30s  scheduler：POLLING → POST poll_endpoint → ...
```

#### SINGLE_CALL（新）
```
T=0    async_task 创建（status=PENDING, poll_strategy=SINGLE_CALL）
       ↓
T=0    scheduler 拉起任务（独立 SINGLE_CALL 线程池）
       ↓  ★ 关键修复 #1：SINGLE_CALL 分支必须在 PENDING→POLLING 转换之前
       status ← SINGLE_CALLED  （"已发起，等响应中"）
       ↓
       POST poll_endpoint（HTTP read timeout = singleCallReadTimeoutSeconds ?? maxWaitSeconds）
       ↓ HTTP 连接挂起 5-10 分钟
T=5m   第三方返回响应
       ↓
       走正常 evaluateCompletion（PERIODIC 走什么 SINGLE_CALL 走什么）：
         - completion_json_path 匹配 → COMPLETED
         - failed_values 匹配 → FAILED
         - 都未匹配 + 已超时 → TIMEOUT
         - SocketTimeoutException（read timeout 到期）→ TIMEOUT
         - 其他网络异常 → FAILED
       ↓
       scheduler 下一轮不再扫此任务（status=SINGLE_CALLED 不在 PENDING/POLLING 范围）
```

#### 启动恢复（新增，修复 v1 致命问题 #3）
```
应用启动 → StartupRecoveryRunner 顺序：
  1. 找 status=SINGLE_CALLED AND started_at < NOW() - INTERVAL 30 MINUTE
     → 标 FAILED（errorMessage="Recovered from crash: stuck in SINGLE_CALLED"）
  2. 找 status=POLLING AND last_polled_at < NOW() - INTERVAL 10 MINUTE
     → 标 POLLING 重置（让下一轮正常拉起；或直接标 FAILED；策略可配）
  3. 打印恢复条数日志
```

**30 分钟阈值**默认，写死在代码里（**不加新配置**）：

```java
private static final int STUCK_SINGLE_CALL_MINUTES = 30;
```

### 2.2 数据模型

```sql
ALTER TABLE async_tasks 
ADD COLUMN poll_strategy VARCHAR(20) NOT NULL DEFAULT 'PERIODIC' 
COMMENT '轮询策略: PERIODIC=周期性 / SINGLE_CALL=只调用一次';

ALTER TABLE async_tasks
ADD COLUMN single_call_read_timeout_seconds INT DEFAULT NULL
COMMENT 'SINGLE_CALL 模式 HTTP read timeout（秒）；NULL 时回退到 maxWaitSeconds';
```

**为什么新增 `single_call_read_timeout_seconds`？**
v1 让 `maxWaitSeconds` 同时表示"PERIODIC 总超时"和"SINGLE_CALL 读超时"——**两个不同维度**：
- PERIODIC 模式下，`maxWaitSeconds` = 任务从 started_at 起的总存活时间
- SINGLE_CALL 模式下，单次 HTTP 读超时 = 第三方多久不响应就算"业务超时"

混用会让运营/排障混乱。新加一列 `single_call_read_timeout_seconds`，NULL 时回退到 `maxWaitSeconds`（保持向后兼容）。

### 2.3 Java 改造

#### 2.3.1 AsyncTask 实体

[AsyncTask.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java) 加 2 个字段：

```java
@TableField("poll_strategy")
private String pollStrategy;  // 'PERIODIC' / 'SINGLE_CALL'

@TableField("single_call_read_timeout_seconds")
private Integer singleCallReadTimeoutSeconds;  // null → 回退到 maxWaitSeconds

// getter / setter
```

#### 2.3.2 AsyncTaskPollingScheduler（修竞态 + 独立线程池）

[AsyncTaskPollingScheduler.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java) 关键改动：

**(a) 独立线程池（修复 v1 致命问题 #4 DoS）**

```java
// 老线程池：仅给 PERIODIC 用，避免 SINGLE_CALL 长请求占满
private final ExecutorService periodicExecutor = 
    Executors.newFixedThreadPool(20);  // 原 executor 改名

// 新线程池：SINGLE_CALL 用
private final ExecutorService singleCallExecutor = 
    Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "async-single-call-" + counter.incrementAndGet());
        t.setDaemon(true);
        return t;
    });
```

shutdown 时两个池都关。

**(b) pollTasks 分发**

```java
@Scheduled(...)
public void pollTasks() {
    List<AsyncTask> tasks = pollingService.findPendingOrPollingTasks(50);
    for (AsyncTask task : tasks) {
        String strategy = task.getPollStrategy() == null ? "PERIODIC" : task.getPollStrategy();
        if ("SINGLE_CALL".equals(strategy)) {
            singleCallExecutor.submit(() -> pollSingleTask(task));
        } else {
            periodicExecutor.submit(() -> pollSingleTask(task));
        }
    }
}
```

**(c) pollSingleTask 修竞态（修复 v1 致命问题 #5）**

v1 错误顺序：
```
startedAt 更新 → PENDING 状态校验 → PENDING→POLLING 转换 → SINGLE_CALL 分支（PENDING→SINGLE_CALLED）
                                          ↑
                                这里 POLLING 状态下，findPendingOrPolling 还能查到同一行
                                → 另一个线程会重复发起
```

**正确顺序**：
```
startedAt 更新 → 状态校验（PENDING/POLLING）→ 读取 pollStrategy
                                          ↓
                              ┌── SINGLE_CALL ──┐    ┌── PERIODIC ──┐
                              │ PENDING→SINGLE_ │    │ PENDING→      │
                              │ CALLED 一次性    │    │ POLLING       │
                              │ 发 HTTP 请求    │    │ 发 HTTP 请求  │
                              └─────────────────┘    └───────────────┘
                                          ↓
                              catch 块：SINGLE_CALL 走 FAILED/TIMEOUT
                                       PERIODIC 走 retry 计数
```

关键代码（替换现有 `pollSingleTask` 中的状态转换块）：

```java
String pollStrategy = task.getPollStrategy() == null ? "PERIODIC" : task.getPollStrategy();
boolean isSingleCall = "SINGLE_CALL".equals(pollStrategy);

// 修竞态 #5：SINGLE_CALL 模式下，状态 PENDING 才处理；POLLING 不处理
if (isSingleCall && !"PENDING".equals(status)) {
    return;
}

// 修竞态 #5：SINGLE_CALL 不做 PENDING→POLLING 转换，直接 PENDING→SINGLE_CALLED
if (isSingleCall) {
    pollingService.updateStatus(task.getId(), "SINGLE_CALLED", null);
} else if ("PENDING".equals(status)) {
    pollingService.updateStatusAndLastPolled(task.getId(), "POLLING");
}

// 计算 read timeout（修复 maxWaitSeconds 语义双重含义）
Integer readTimeoutSeconds = null;
if (isSingleCall) {
    Integer explicit = task.getSingleCallReadTimeoutSeconds();
    readTimeoutSeconds = explicit != null ? explicit : task.getMaxWaitSeconds();
    if (readTimeoutSeconds == null) {
        readTimeoutSeconds = 600;  // 兜底默认 10 分钟
    }
}

try {
    pollResponse = apiProxyService.callApi(
        task.getPollEndpoint(),
        task.getPollMethod() != null ? task.getPollMethod().toUpperCase() : "GET",
        pollHeaders,
        null,
        readTimeoutSeconds  // ← 复用现有 int timeoutSeconds 重载（详见 2.3.3）
    );
    // 走正常 evaluateCompletion 流程（PERIODIC/SINGLE_CALL 共用）
} catch (Exception netEx) {
    if (isSingleCall) {
        if (netEx instanceof java.net.SocketTimeoutException) {
            pollingService.updatePollResult(task.getId(), "TIMEOUT", null,
                "Single call timed out after " + readTimeoutSeconds + " seconds");
        } else {
            pollingService.updatePollResult(task.getId(), "FAILED", null,
                "Single call failed: " + netEx.getMessage());
        }
        return;  // ← SINGLE_CALL 不进 PERIODIC 的 retry 逻辑
    }
    // PERIODIC：原 retry 逻辑
    throw netEx;
}
```

#### 2.3.3 ApiProxyService 改造（**复用现有重载，不引入新签名**）

修复 v1 致命问题 #1：v1 想加 `Integer readTimeoutMs` 5 参数重载，**与现有 `int timeoutSeconds` 重载编译冲突**（autoboxing 后签名重复）。

**正确做法**：**复用现有** [ApiProxyService.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/ApiProxyService.java#L79-L86) 的 5 参数 `int timeoutSeconds` 重载。

```java
// 现有签名（不改）：
public Object callApi(String url, String method, Map<String, ?> headers, Object body, int timeoutSeconds)
```

scheduler 传 `task.getSingleCallReadTimeoutSeconds() ?? task.getMaxWaitSeconds() ?? 600`（**单位是秒**）。`ApiProxyService` 内部 `factory.setReadTimeout(timeoutSeconds * 1000)` 已经处理秒→毫秒转换。

**现有所有重载保持不变**（4 参数 / 5 参数 HttpClientAuditMode / 5 参数 timeoutSeconds / 6 参数）。本次不引入新签名。

#### 2.3.4 启动恢复：StartupRecoveryRunner

**新文件**：`backend/skill-gateway/.../config/StartupRecoveryRunner.java`

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)  // 在 SchemaMigrationRunner 之后
public class StartupRecoveryRunner implements InitializingBean {

    /** 卡住超过 30 分钟的 SINGLE_CALLED 任务视为崩溃遗留，启动时标 FAILED。 */
    private static final int STUCK_SINGLE_CALL_MINUTES = 30;

    @Override
    public void afterPropertiesSet() {
        try {
            int recovered = asyncTaskMapper.recoverStuckSingleCallTasks(STUCK_SINGLE_CALL_MINUTES);
            if (recovered > 0) {
                log.warn("[StartupRecovery] Marked {} SINGLE_CALLED tasks as FAILED (stuck > {} min)",
                    recovered, STUCK_SINGLE_CALL_MINUTES);
            }
        } catch (Exception e) {
            log.warn("[StartupRecovery] Failed: {}", e.getMessage());
        }
    }
}
```

#### 2.3.5 AsyncTaskMapper 新增方法

[AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java) 加：

```java
@Update("UPDATE async_tasks SET status='FAILED', " +
        "error_message=CONCAT('Recovered from crash: stuck in SINGLE_CALLED > ', #{minutes}, ' minutes'), " +
        "completed_at=NOW(), updated_at=NOW() " +
        "WHERE status='SINGLE_CALLED' " +
        "AND started_at < DATE_SUB(NOW(), INTERVAL #{minutes} MINUTE)")
int recoverStuckSingleCallTasks(@Param("minutes") int minutes);
```

### 2.4 自动 Schema 迁移

[SchemaMigrationRunner.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SchemaMigrationRunner.java) 加 2 项：

```java
// 1. poll_strategy 列
ensureColumn(conn, "async_tasks", "poll_strategy", existingColumns,
    "ALTER TABLE async_tasks ADD COLUMN poll_strategy VARCHAR(20) NOT NULL DEFAULT 'PERIODIC' " +
    "COMMENT '轮询策略: PERIODIC=周期性 / SINGLE_CALL=只调用一次'");

// 2. single_call_read_timeout_seconds 列
ensureColumn(conn, "async_tasks", "single_call_read_timeout_seconds", existingColumns,
    "ALTER TABLE async_tasks ADD COLUMN single_call_read_timeout_seconds INT DEFAULT NULL " +
    "COMMENT 'SINGLE_CALL 模式 HTTP read timeout（秒）'");
```

### 2.5 DTO 加 pollStrategy 字段

[AsyncTaskNotificationDto.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/dto/AsyncTaskNotificationDto.java)：

```java
private String pollStrategy;  // 'PERIODIC' / 'SINGLE_CALL'
```

**`from()` 工厂方法里必须加赋值**（v1 漏了）：
```java
d.pollStrategy = t.getPollStrategy();
```

`pollStrategy` 不加 `@JsonFormat`（非时间字段）。

### 2.6 前端改造

[useAsyncTaskNotifications.ts](file:///Users/dccb/botproject/bxdc-bot/frontend/src/composables/useAsyncTaskNotifications.ts) 类型扩展：

```typescript
export interface AsyncTaskNotification {
  // ... 现有字段 ...
  status: 'PENDING' | 'POLLING' | 'SINGLE_CALLED' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | string
  pollStrategy: 'PERIODIC' | 'SINGLE_CALL' | null
  // ...
}
```

[TaskNotificationBell.vue](file:///Users/dccb/botproject/bxdc-bot/frontend/src/components/TaskNotificationBell.vue)：

- `statusLabel` 加 `case 'SINGLE_CALLED': return '单次调用中'`
- `statusColor` 加 `case 'SINGLE_CALLED': return 'primary'`（v1 漏了）
- 详情弹窗加"轮询策略"行
- `fmtTime` 改为 import `parseBackendTimeAsUtc` from `@/utils/datetime`

### 2.7 审计日志事件

v1 的 `GATEWAY_POLL_START` / `GATEWAY_POLL_COMPLETE` 在 SINGLE_CALL 模式下语义错位。**最小改动**：在 `extraJson` 里加 `pollStrategy` 字段（不改 event type，避免破坏既有审计查询）：

```java
Map<String, Object> extra = new HashMap<>();
extra.put("retryCount", task.getPollRetryCount() != null ? task.getPollRetryCount() : 0);
extra.put("pollStrategy", task.getPollStrategy());  // 新增
startLog.setExtraJson(auditService.safeJson(extra));
```

---

## 3. 修复重复异步任务 bug（去重在调第三方之前，按 session 维度）

### 3.1 问题

**用户反馈 1**："之前的一个问题会触发两次异步任务，异步消息栏有两个任务了"。

**用户反馈 2（更严重）**："我看不止是调用了两次接口，甚至调用了很多次，agent 一直在调用，实际上调用的接口已经在第三方平台执行了，你这样调用会把人家服务搞坏的。"

**用户反馈 3（最关键）**：第三方日志可能也调用了 5 次——**如果第一次调就有返回，不要在一个对话里面调用多次了**。

**v2 设计错在哪？**
- v2 去重在调完第三方 → 提取 `externalTaskId` 之后才做，**来不及**（第三方已被打）

**v2.1 设计还有漏洞：**
- v2.1 用 `(user_id, request_signature)` + **60s 窗口**做去重
- LLM 在同一个对话里间隔 > 60s 再调一次 → 60s 窗口已过期 → 创建新任务 → 第三方被打第二次
- **第一次调就有返回（即使立即返回了），后续重试还会打到第三方**——这正是用户反馈的痛点

**v2.2 修复：按 session 维度去重**
- 去重键加上 `sessionId` → 同一个对话里的重复调用**全部被拦截**
- 窗口延长到 **1 小时**（写死在代码里，不加配置）——足以覆盖一个完整对话
- 任意状态（进行中 / 终态）都视为重复——**只要在同 session + 1h 内 + 同签名，绝不调第三方**
- 不同 session 调同样的接口 → **不**去重（新对话可以重新问同样的问题）

### 3.2 修复策略

**位置**：`SkillController.callApiAsync` 在 `asyncPoll` 校验之后、**调用第三方之前**就做去重。

**去重键**：`(user_id, session_id, request_signature)`。

**去重窗口**：
- 有 `sessionId`（正常路径，agent-core 总会传）：`DedupConfig.PER_SESSION_WINDOW_SECONDS = 3600`（**1 小时**）
- 没 `sessionId`（边缘情况）：`DedupConfig.NO_SESSION_WINDOW_SECONDS = 60`

**去重行为**：查到匹配任务 → **直接返回既有 `asyncTaskId` + deduped: true**，**不调第三方**、**不创建新任务**、**不动既有任务状态**。**任意状态都触发**（PENDING / POLLING / SINGLE_CALLED / COMPLETED / FAILED / TIMEOUT 全部算重复）。

**新列**：`async_tasks.request_signature VARCHAR(64)` —— SHA-256 hex。

**索引**：`idx_async_user_session_sig_time (user_id, session_id, request_signature, created_at)`——把 `session_id` 加进索引，让 per-session 查询走索引扫描。

**签名计算**：
```
signature = SHA-256(
    method + "|" +
    url + "|" +
    canonicalJson(body) + "|" +
    idJsonPath + "|" +
    pollMethod + "|" +
    pollEndpoint
)
```

`canonicalJson(body)` 递归排序 key（保证 LLM 传参顺序差异不影响签名）。如果 body 是 null/原始字符串，直接用原值。

### 3.3 数据模型

```sql
ALTER TABLE async_tasks
ADD COLUMN request_signature VARCHAR(64) DEFAULT NULL
COMMENT '请求签名 SHA-256 hex（去重用）';

ALTER TABLE async_tasks
ADD INDEX idx_async_user_session_sig_time (user_id, session_id, request_signature, created_at);
```

**为什么索引带 session_id？**
去重查询是热路径（每次 `/api/skills/api/async` 请求都要查一次）。`session_id` 进索引后，per-session 查询变成索引前缀扫描，性能更稳。

### 3.4 Java 改造

#### 3.4.1 AsyncTask 实体加字段

[AsyncTask.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java)：

```java
@TableField("request_signature")
private String requestSignature;  // SHA-256 hex，64 字符

// getter / setter
```

#### 3.4.2 签名工具类

**新文件**：`backend/skill-gateway/.../util/RequestSignatureUtil.java`

```java
public final class RequestSignatureUtil {
    private RequestSignatureUtil() {}

    /**
     * 计算请求签名。签名是 (method, url, canonicalBody, idJsonPath, pollMethod, pollEndpoint)
     * 的 SHA-256 hex。对 body 做 key 排序，保证 LLM 传参顺序差异不影响。
     */
    public static String compute(
            String method,
            String url,
            Object body,
            String idJsonPath,
            String pollMethod,
            String pollEndpoint
    ) {
        String canonicalBody = canonicalizeJson(body);
        String raw = (method == null ? "" : method) + "|"
                   + (url == null ? "" : url) + "|"
                   + canonicalBody + "|"
                   + (idJsonPath == null ? "" : idJsonPath) + "|"
                   + (pollMethod == null ? "" : pollMethod) + "|"
                   + (pollEndpoint == null ? "" : pollEndpoint);
        return sha256Hex(raw);
    }

    private static String canonicalizeJson(Object body) {
        if (body == null) return "";
        try {
            ObjectMapper om = new ObjectMapper();
            JsonNode tree = om.valueToTree(body);
            return om.writeValueAsString(sortKeys(tree));
        } catch (Exception e) {
            return String.valueOf(body);
        }
    }

    private static JsonNode sortKeys(JsonNode node) { /* 递归排序 key */ ... }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
```

#### 3.4.3 AsyncTaskMapper 新增方法

[AsyncTaskMapper.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java)：

```java
/**
 * 按 session 维度查找最近任务，用于幂等去重。
 * - 优先按 (userId, sessionId, signature) 查（per-session 1 小时窗口）
 * - 如果 sessionId 为空，按 (userId, signature) 查（fallback 60s 窗口）
 * - 任意状态（PENDING/POLLING/SINGLE_CALLED/COMPLETED/FAILED/TIMEOUT）都算重复
 *   ——同一对话里"调完就有结果"的情况下，agent 也不能再调第二次
 */
default AsyncTask findRecentBySignatureInSession(
        String userId, String sessionId, String signature, int windowSeconds) {
    LambdaQueryWrapper<AsyncTask> wrapper = new LambdaQueryWrapper<AsyncTask>()
            .eq(AsyncTask::getUserId, userId)
            .eq(AsyncTask::getRequestSignature, signature)
            .ge(AsyncTask::getCreatedAt,
                LocalDateTime.now().minusSeconds(windowSeconds))
            .orderByDesc(AsyncTask::getCreatedAt)
            .last("LIMIT 1");
    if (sessionId != null && !sessionId.isBlank()) {
        wrapper.eq(AsyncTask::getSessionId, sessionId);
    }
    return selectOne(wrapper);
}
```

**注意**：
- `ge(created_at, NOW() - window)` 即可。`LocalDateTime` 转 SQL 时 MyBatis-Plus 用驱动默认转换（受 `serverTimezone=UTC` 影响），跟 DB 写入对齐
- 没有 `in(status, ...)` 过滤——**任意状态都返回**（含 COMPLETED/FAILED/TIMEOUT）

#### 3.4.4 SkillController.callApiAsync 改造（核心：去重在调第三方**之前**）

[SkillController.java:200-280](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java#L200-L280) `callApiAsync` 整个方法重组：

```java
@PostMapping("/api/async")
public ResponseEntity<?> callApiAsync(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @RequestHeader(value = "X-Skill-Id", required = false) Long skillId,
        @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
        @RequestBody ApiRequest request
) {
    try {
        // ====== 1. 校验 asyncPoll ======
        Map<String, Object> asyncPoll = request.getAsyncPoll();
        if (asyncPoll == null || !asyncPoll.containsKey("pollEndpoint")) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error",
                "asyncPoll.pollEndpoint is required for async API calls"));
        }

        // ====== 2. ★★★ 去重在调第三方之前（关键修复） ★★★ ======
        String signature = RequestSignatureUtil.compute(
            request.getMethod() != null ? request.getMethod().toUpperCase() : "GET",
            request.getUrl(),
            request.getBody(),
            (String) asyncPoll.get("idJsonPath"),
            (String) asyncPoll.get("pollMethod"),
            (String) asyncPoll.get("pollEndpoint")
        );

        AsyncTask existing = asyncTaskPollingService.findRecentBySignature(
            userId, signature, DedupConfig.WINDOW_SECONDS);
        if (existing != null) {
            log.info("[callApiAsync] Duplicate request dedup'd before third-party call: user={}, sig={}, existing asyncTaskId={}, status={}",
                userId, signature.substring(0, 8) + "...", existing.getId(), existing.getStatus());
            // 写审计（可选）
            // pollingAuditService.log(auditService.buildBaseLog(existing, "DUPLICATE_REQUEST"));
            return ResponseEntity.ok(new HashMap<String, Object>() {{
                put("asyncTaskId", existing.getId());
                put("status", existing.getStatus());
                put("externalTaskId", existing.getExternalTaskId());
                put("deduped", true);  // 新字段：标记是去重返回
            }});
        }
        // ====== 去重结束 ======

        // ====== 3. 调第三方（只在去重未命中时执行） ======
        int timeoutSeconds = request.getTimeoutSeconds() != null ? request.getTimeoutSeconds() : 30;
        Object initialResponse = builtinToolExecutionService.callExternalApi(request);

        String initialResponseStr = initialResponse instanceof String
                ? (String) initialResponse
                : objectMapper.writeValueAsString(initialResponse);

        // ====== 4. 提取 externalTaskId（原有逻辑） ======
        String idJsonPath = (String) asyncPoll.get("idJsonPath");
        String externalTaskId = asyncTaskPollingService.extractTaskId(initialResponseStr, idJsonPath);
        if (externalTaskId == null || StringUtils.isBlank(externalTaskId)) {
            return ResponseEntity.badRequest().body(/* 原有错误响应 */);
        }

        // ====== 5. 构造 pollEndpoint（原有逻辑） ======
        String pollEndpointTemplate = (String) asyncPoll.get("pollEndpoint");
        if (!pollEndpointTemplate.contains("{id}")) {
            return ResponseEntity.badRequest().body(/* 原有错误响应 */);
        }
        String pollEndpoint = pollEndpointTemplate.replace("{id}", externalTaskId);

        // ====== 6. 构造 AsyncTask 并保存（带 requestSignature） ======
        int pollIntervalSeconds = /* 原有逻辑 */;
        int maxWaitSeconds = /* 原有逻辑 */;

        AsyncTask task = new AsyncTask();
        task.setSkillId(skillId);
        task.setUserId(userId);
        task.setSessionId(sessionId);
        task.setExternalTaskId(externalTaskId);
        task.setPollEndpoint(pollEndpoint);
        task.setPollMethod(/* 原有逻辑 */);
        task.setPollIntervalSeconds(pollIntervalSeconds);
        task.setMaxWaitSeconds(maxWaitSeconds);
        task.setCompletionJsonPath((String) asyncPoll.get("completionJsonPath"));
        task.setCompletionValue((String) asyncPoll.get("completionValue"));
        task.setResultJsonPath((String) asyncPoll.get("resultJsonPath"));
        if (asyncPoll.get("failedValues") != null) {
            task.setFailedValues(objectMapper.writeValueAsString(asyncPoll.get("failedValues")));
        }
        if (asyncPoll.get("pollHeaders") != null) {
            task.setPollHeaders(objectMapper.writeValueAsString(asyncPoll.get("pollHeaders")));
        }
        task.setInitialResponse(initialResponseStr);
        task.setRequestSignature(signature);  // ★ 新增：存签名用于后续去重

        asyncTaskPollingService.createTask(task);

        return ResponseEntity.ok(new HashMap<String, Object>() {{
            put("asyncTaskId", task.getId());
            put("status", "PENDING");
            put("externalTaskId", externalTaskId);
        }});
    } catch (Exception e) {
        return ResponseEntity.internalServerError().body(Collections.singletonMap("error",
            "Async API call failed: " + e.getMessage()));
    }
}
```

**关键约束**：
- **去重步骤 2 在调第三方步骤 3 之前**——这是 v2.1 的核心修复
- **不调第三方** / **不创建新任务** / **不重置既有任务状态**
- **响应字段 `asyncTaskId` / `status` / `externalTaskId` 完全兼容**老调用方
- 新增可选字段 `deduped: true`

#### 3.4.5 写死窗口常量

**新文件**：`backend/skill-gateway/.../config/DedupConfig.java`

```java
public final class DedupConfig {
    private DedupConfig() {}

    /** Per-session 去重窗口（秒）。同 session + 同签名 + 1 小时内 → 视为重复，**任意状态都算**。 */
    public static final int PER_SESSION_WINDOW_SECONDS = 3600;

    /** 没有 sessionId 时的 fallback 窗口（秒）。60 秒。 */
    public static final int NO_SESSION_WINDOW_SECONDS = 60;
}
```

**不加新配置**（用户要求）。后续若需要调整，**直接改这个常量**。

#### 3.4.6 AsyncTaskPollingService 新增方法

[AsyncTaskPollingService.java](file:///Users/dccb/botproject/bxdc-bot/backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingService.java)：

```java
public AsyncTask findRecentBySignatureInSession(
        String userId, String sessionId, String signature, int windowSeconds) {
    if (userId == null || signature == null) return null;
    return asyncTaskMapper.findRecentBySignatureInSession(userId, sessionId, signature, windowSeconds);
}
```

#### 3.4.7 上线前数据修复

已有任务（`request_signature IS NULL`）不会被新查询命中（WHERE 条件要 `request_signature = ?`）。**老数据无需修复**。

### 3.5 竞态分析

**场景**：T=0 和 T=10ms 两个并发请求都进入去重检查，都查到 `null`，都执行调第三方。

**结果**：
- 两个都调了第三方（**这次还是要打 2 次**）
- 然后都创建任务 A 和 B
- 用户看到 2 条任务

**修复方式**（v2.1 接受残留，**本次不做更激进的修复**）：
- 真正的修复需要 DB 唯一约束（MySQL 不支持部分唯一索引）或分布式锁
- **本次接受这个 1% 极端竞态**，作为 follow-up

**对最终用户体验**：
- 99% 的重复请求（LLM 在 ReAct 里循环调用）会被去重**在调第三方之前**拦截 ✓
- 1% 极端竞态仍是 2 条任务，**用户能接受**（v1 时也接受 2 条任务这个现状）

### 3.6 前端/Agent 端是否要改？

**前端**：不需要——接口行为完全兼容，重复请求会被去重"吃"掉，**第三方都不会被打到**。

**Agent 端 (`executeConfiguredApiSkillAsync`)**：不需要改代码。可选优化：读 `deduped: true` 时**直接走 wait 拿响应**（避免重复轮询）。本次不强制改。

### 3.7 审计

在 `SkillController` 里命中重复时，**写一条 `DUPLICATE_REQUEST` 审计日志**（构造 `AsyncPollingAuditLog` 直接写库）。让运维能看到 agent 重复调用的频率。

---

## 4. 实施顺序（原子发布单元）

> 每个 ★ 是一个**必须同时发布**的原子点（编译/部署不能跨点拆开）。

| 步骤 | 内容 | 是否原子 |
|---|---|---|
| 1 | 后端 L3 + L4 时区代码（MybatisPlusConfig + DTO） | ★ 原子 1 |
| 2 | 前端 `parseBackendTimeAsUtc` 工具函数 + 移到 `utils/datetime.ts` | 原子 1 配套 |
| 3 | 后端：schema 迁移加 2 列（poll_strategy + single_call_read_timeout_seconds） | ★ 原子 2 |
| 4 | 后端：AsyncTask 实体加 2 字段 | 原子 2 配套 |
| 5 | 后端：AsyncTaskNotificationDto 加 pollStrategy + from() 赋值 | 原子 2 配套 |
| 6 | 后端：StartupRecoveryRunner 新建 + AsyncTaskMapper 新方法 | 原子 2 配套 |
| 7 | 后端：AsyncTaskPollingScheduler 改造（独立线程池 + 修竞态 + SINGLE_CALL 分支） | ★ 原子 2 收尾 |
| 8 | 前端：types 扩展 + statusLabel/statusColor + 详情弹窗 | 原子 2 配套 |
| 9 | 后端：schema 迁移加 `request_signature` 列 + 索引 | ★ 原子 3 |
| 10 | 后端：AsyncTask 实体加 `requestSignature` 字段 | 原子 3 配套 |
| 11 | 后端：`RequestSignatureUtil` 工具类 + `DedupConfig` 常量类 | 原子 3 配套 |
| 12 | 后端：AsyncTaskMapper 加 `findRecentBySignature` + AsyncTaskPollingService 封装 | 原子 3 配套 |
| 13 | 后端：SkillController.callApiAsync 加**调第三方之前**的去重检查 + DUPLICATE_REQUEST 审计 | ★ 原子 3 收尾 |

**关键约束**：
- 原子 1 单独可发布（不影响老逻辑，纯时区修复）
- 原子 2 必须**整体发布**（scheduler 读 poll_strategy 字段，缺列就 NPE；缺实体就编译错）
- 原子 3 必须**整体发布**（`requestSignature` 字段写库，缺列就 SQL 报错；缺实体就编译错）

**优先级建议**：
- **原子 3（去重）必须最先发布**——用户反馈"会把人家服务搞坏"是当前最严重问题
- 原子 1（时区）可第二批
- 原子 2（SINGLE_CALL）最后（不紧急）

---

## 5. 兼容性 / 回退

| 范围 | 兼容性 | 回退方式 |
|---|---|---|
| 时区修复 | 不破坏老 DTO（仅 4 个字段序列化方式变化） | 移除 DTO @JsonFormat 改回原 pattern；`MybatisPlusConfig` `LocalDateTime.now()` 改回 |
| 启动恢复 | 启动时自动恢复，纯只读扫描 | 移除 `StartupRecoveryRunner` 即可禁用 |
| 独立线程池 | PERIODIC 用老池，SINGLE_CALL 用新池，**互不影响** | 把 `singleCallExecutor` 改回 `periodicExecutor` |
| poll_strategy 列 | DEFAULT 'PERIODIC'，老数据行为不变 | 不回退（保留列无副作用） |
| single_call_read_timeout_seconds 列 | DEFAULT NULL，NULL 时回退 maxWaitSeconds | 不回退（保留列无副作用） |
| SINGLE_CALL 分支 | PERIODIC 路径**完全不动** | 删除 scheduler 中的 `isSingleCall` 分支 |
| request_signature 列 | DEFAULT NULL，老数据无影响 | 不回退（保留列无副作用） |
| 调第三方前去重 | 响应字段兼容；老调用方不读 `deduped` 字段也不报错 | 删除 `SkillController.callApiAsync` 里的去重块即可恢复"无去重"行为（但**第三方会被打多次**） |
| ApiProxyService | **完全不改**（复用现有重载） | N/A |
| 通知中心 badge | **完全不改**（用户确认原状 OK） | N/A |
| 不加新配置 | JVM 启动参数 / `application.properties` / 环境变量都**不增加** | N/A |

**老数据审计 SQL**（上线前执行，确认无 SINGLE_CALLED 卡住的"僵尸"）：

```sql
SELECT id, status, started_at, external_task_id, user_id
FROM async_tasks
WHERE status = 'SINGLE_CALLED'
  AND started_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE);
```

如果有行 → 启动恢复会处理，无需手动；没有则 0 行返回，安全。

**id 一致性**：

```sql
SELECT t.id, COUNT(al.id)
FROM async_tasks t
LEFT JOIN async_polling_audit_logs al ON al.async_task_id = t.id
GROUP BY t.id
HAVING t.id != al.async_task_id;
```

应返回 0 行。如有 → 阻塞发布，先 DBD 修复。

---

## 6. 测试 / 验证

### 后端
- `mvn compile` / `mvn test`
- 单测：MybatisPlusConfig 注入 `LocalDateTime.now(ZoneOffset.UTC)`（用 Clock 注入验证 UTC）
- 单测：`recoverStuckSingleCallTasks` 把超时的 SINGLE_CALLED 标 FAILED
- **单测：`RequestSignatureUtil.compute`**：相同 (method, url, body, ...) → 相同 hash；body 字段顺序不同 → 相同 hash；body 值不同 → 不同 hash
- **单测：`findRecentBySignatureInSession`**：同 session + 同签名 + 1h 内任意状态都查到；不同 session 不查到；不同 signature 查不到；NULL signature 不命中
- **单测 / 集成：`callApiAsync` 去重**：
  - **核心场景**：同 session 下第一次请求正常调第三方；立即用相同参数再请求 → **不调第三方**，直接返回既有 `asyncTaskId`，body 中含 `deduped: true`
  - 不同 session 调同样的请求 → 创建新任务，第三方被调第二次
  - 不同的 body / URL → 创建新任务
- 集成：跑一次 PERIODIC 老任务，行为不变

### 前端
- `npm run build`
- 手动验证：JVM=CST 时通知中心时间显示为正确北京时间
- **手动验证 badge 行为不变**：现有 `t-badge :count="unreadCount"` 完全不动，行为跟 v1 一致

### 端到端
- 创建 SINGLE_CALL 任务 → 5-10 分钟后看 COMPLETED
- 创建 SINGLE_CALL 任务且第三方 5 秒后返回 200 → 立刻看 COMPLETED
- 创建 SINGLE_CALL 任务，第三方 15 分钟不响应 → 看 TIMEOUT
- 启动 skill-gateway，发现 30 分钟前 SINGLE_CALLED 卡住的任务 → 启动日志显示"Marked N tasks as FAILED"
- **去重核心场景**：模拟 agent 重复调 `/api/skills/api/async` 5 次（间隔 < 1s，相同参数）→ 通知中心只有 1 条任务，**第三方日志只看到 1 次调用**
- **去重合法重试**：任务 COMPLETED 后 60s 后用户重发相同问题 → 创建新任务，**第三方被打第二次**（这是预期）

### 回归
- 老的 PERIODIC 任务：未改动任何代码路径，行为完全一致
- 老的 async_task 数据：poll_strategy DEFAULT 'PERIODIC'，行为完全一致
- 时区回归：通知中心以外的时间字段（如有）需检查 Jackson 全局配置生效
- 通知中心 badge 显示逻辑：**完全不变**
- **第三方平台**：上线后通过日志 / 监控确认第三方收到的请求量大幅下降（如果之前 agent 重试 N 次都打了 N 次，现在只打 1 次）

---

## 7. v1 → v2.2 变更对照

| v1 致命问题 | v2 / v2.1 / v2.2 修复位置 |
|---|---|
| #1 ApiProxyService 重载冲突 | 2.3.3 复用现有 `int timeoutSeconds` 重载，**不引入新签名** |
| #2 时区假设不验证 | 1.1 2 层代码修复（L3 + L4），**不加任何新配置**（v2.1 砍掉 L1/L2） |
| #3 SINGLE_CALL 无崩溃恢复 | 2.3.4 StartupRecoveryRunner；2.3.5 Mapper 方法 |
| #4 线程池耗尽 | 2.3.2(a) PERIODIC/SINGLE_CALL 独立线程池 |
| #5 状态转换竞态 | 2.3.2(c) 修竞态：SINGLE_CALL 跳过 PENDING→POLLING |

| v1 重要问题 | v2 / v2.1 修复位置 |
|---|---|
| maxWaitSeconds 语义双重 | 2.2 新增 `single_call_read_timeout_seconds` 列 |
| DTO from() 漏赋值 | 2.5 显式加 `d.pollStrategy = t.getPollStrategy()` |
| 审计日志 event type 错位 | 2.7 extraJson 加 pollStrategy，event type 保持 |
| 解析工具函数位置错 | 1.3 移到 `utils/datetime.ts` 公共模块 |
| statusColor 漏 SINGLE_CALLED | 2.6 加 `case 'SINGLE_CALLED': return 'primary'` |

| v2.1 用户反馈调整 | 修复位置 |
|---|---|
| badge 原状没问题 | **整个原子 3 砍掉**，badge 维持 v1 行为 |
| 不加新配置 | **L1 / L2 砍掉**，只用 L3 / L4 代码改动 |
| 去重必须在调第三方之前 | 3.4.4 重组 `callApiAsync`：去重步骤 2 在调第三方步骤 3 **之前**；改用请求签名 hash（不是 externalTaskId） |

| **v2.2 用户反馈调整** | 修复位置 |
|---|---|
| 第三方日志可能被调 5 次，**"第一次调就有返回，不要在一个对话里面调用多次"** | 3.2 把 `sessionId` 加进去重键；窗口 60s → **1 小时**；**任意状态都算重复**（含 COMPLETED / FAILED / TIMEOUT）。3.3 索引 `idx_async_user_session_sig_time` 加上 `session_id`。3.4.3 mapper 改为 `findRecentBySignatureInSession(userId, sessionId, signature, windowSeconds)`。3.4.5 `DedupConfig` 拆成 `PER_SESSION_WINDOW_SECONDS=3600` + `NO_SESSION_WINDOW_SECONDS=60` 两个常量。 |
