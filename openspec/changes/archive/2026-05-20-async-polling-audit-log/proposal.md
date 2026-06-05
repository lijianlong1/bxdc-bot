## Why

异步轮询 Skill 经常不好用，排查问题困难。当前只有零散的 `log.debug`/`log.error` 打到标准输出，缺少结构化、可追溯的审计日志，无法快速定位：

1. 到底调没调 poll endpoint？网络返回了什么？
2. completion 判断为什么没命中？实际的 jsonPath 提取值是什么？
3. 失败重试了没有？在哪个阶段出了什么异常？
4. 哪个用户触发的？关联哪个 session？

## What Changes

新增 `async_polling_audit_logs` 表 + 审计日志写入逻辑，覆盖 Agent Core → Gateway → 外部 API 的**全链路轮询生命周期**。

每条 audit 记录一个**阶段**（phase），一个 async_task 在一次轮询周期中会产生 5~8 条 audit 日志，完整记录：

| 阶段 | 记录方 | 内容 |
|------|--------|------|
| `AGENT_REQUEST` | Agent Core | 发起 `GET .../wait`，含 `timeoutMs`、`skillId`、`sessionId` |
| `GATEWAY_POLL_START` | Gateway Scheduler | 开始轮询，含 `pollEndpoint`、`pollMethod`、当前 `retryCount` |
| `NETWORK_REQUEST` | Gateway Scheduler | HTTP 请求详情（url、method、headers 脱敏）、响应 status code、响应体（截断）、耗时 ms |
| `NETWORK_ERROR` | Gateway Scheduler | 网络异常（连接超时、DNS 错误等）完整堆栈 |
| `EVALUATION` | Gateway Scheduler | 解析结果：completion 是否命中、实际 `jsonPath` 取值、failed 判定、超时判定 |
| `GATEWAY_POLL_COMPLETE` | Gateway Scheduler | 终态（COMPLETED/FAILED/TIMEOUT）、`errorMessage` |
| `AGENT_RESPONSE` | Agent Core | Agent Core 收到 `GET .../wait` 响应，含 `status`、`result` |
| `AGENT_ERROR` | Agent Core | Agent Core 层异常（网络错误、解析失败等） |

### 数据库表

```sql
CREATE TABLE async_polling_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  async_task_id BIGINT NOT NULL,
  skill_id BIGINT,
  user_id VARCHAR(128),
  session_id VARCHAR(128),
  phase VARCHAR(32) NOT NULL COMMENT 'AGENT_REQUEST|GATEWAY_POLL_START|NETWORK_REQUEST|NETWORK_ERROR|EVALUATION|GATEWAY_POLL_COMPLETE|AGENT_RESPONSE|AGENT_ERROR',
  recorded_at DATETIME(3) NOT NULL,
  duration_ms INT COMMENT '阶段耗时（毫秒）',
  http_method VARCHAR(16),
  http_url VARCHAR(2048),
  http_status_code INT,
  request_headers_json TEXT COMMENT '脱敏后请求头 JSON',
  request_body LONGTEXT COMMENT '请求体（截断到 maxPayloadBytes）',
  response_body MEDIUMTEXT COMMENT '响应体（截断到 maxPayloadBytes）',
  response_truncated TINYINT(1) NOT NULL DEFAULT 0,
  completion_evaluated TINYINT(1) DEFAULT 0,
  completion_expected_value VARCHAR(128),
  completion_actual_value VARCHAR(128),
  completion_matched TINYINT(1),
  failed_evaluated TINYINT(1) DEFAULT 0,
  failed_matched TINYINT(1),
  expired_evaluated TINYINT(1) DEFAULT 0,
  expired TINYINT(1),
  status VARCHAR(32) COMMENT '当前 task status',
  error_message TEXT,
  error_stack TEXT,
  extra_json TEXT COMMENT '附加上下文 JSON',
  INDEX idx_apal_task (async_task_id),
  INDEX idx_apal_user_time (user_id, recorded_at),
  INDEX idx_apal_skill (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 写入点

**Agent Core**（`java-skills.ts` `executeAsyncPollingFlow`）：
- 发起 `GET .../wait` 前：`phase=AGENT_REQUEST`
- 收到响应后：`phase=AGENT_RESPONSE`
- catch 异常：`phase=AGENT_ERROR`

**Gateway Scheduler**（`AsyncTaskPollingScheduler.pollSingleTask`）：
- 进入方法：`phase=GATEWAY_POLL_START`
- `callApi` 成功后：`phase=NETWORK_REQUEST`
- `callApi` catch 后：`phase=NETWORK_ERROR`
- completion/failed/timeout 评估：`phase=EVALUATION`
- 终态写入后：`phase=GATEWAY_POLL_COMPLETE`

写入方式：新增 `AsyncPollingAuditService`，由 Scheduler 和 Agent Core 各自调 Gateway 的 `POST /api/internal/polling-audit/events` 落库。

## Capabilities

### New Capabilities
- `async-polling-audit-log`: 异步轮询全链路审计日志，覆盖 Agent Core / Gateway / 网络 / 解析四个阶段的每次轮询请求和评估结果

### Modified Capabilities
无

## Impact

**受影响的代码**：
- `backend/skill-gateway/entity/AsyncPollingAuditLog.java` — **新增** 实体
- `backend/skill-gateway/mapper/AsyncPollingAuditLogMapper.java` — **新增** MyBatis-Plus Mapper
- `backend/skill-gateway/service/AsyncPollingAuditService.java` — **新增** 审计日志写入服务
- `backend/skill-gateway/controller/SkillController.java` — **新增** `POST /api/internal/polling-audit/events`
- `backend/skill-gateway/service/AsyncTaskPollingScheduler.java` — 在 `pollSingleTask` 各阶段插入 `auditService.log(...)`
- `backend/skill-gateway/config/SecurityConfig.java` — `ApiTokenFilter` + antMatchers 放通 `/api/internal/polling-audit/**`
- `backend/agent-core/src/tools/java-skills.ts` — `executeAsyncPollingFlow` 发起/收到响应/异常时调 `POST /api/internal/polling-audit/events`
- `docs/deploy-ddl/004-async-polling-audit.sql` — **新增** DDL

**数据库变更**：新增 `async_polling_audit_logs` 表

**不兼容**：无。纯新增审计日志，不影响现有轮询逻辑。
