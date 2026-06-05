## Context

当前异步轮询链路：

```
Agent Core                               Gateway Scheduler                      外部 API
    │                                         │                                    │
    │ GET /api/skills/async-tasks/{id}/wait   │                                    │
    ├────────────────────────────────────────►│                                    │
    │                                         │ @Scheduled pollSingleTask           │
    │                                         │   callApi(pollEndpoint) ────────────►│
    │                                         │   ◄── response ────────────────────│
    │                                         │   evaluateCompletion               │
    │                                         │   evaluateFailure                  │
    │                                         │   isExpired                        │
    │  while(true) { selectById }             │                                    │
    │  ◄── COMPLETED/FAILED/TIMEOUT ──────────│                                    │
```

排查问题时四个环节都可能出问题：网络不通 → 响应格式不对 → jsonPath 取值不匹配 → Agent Core 超时。

## Decisions

### 1. 审计日志表 vs 复用 async_tasks 字段

**选择**：独立表 `async_polling_audit_logs`

**理由**：一次轮询可能产生多轮 scheduler 调用（PENDING → POLLING → 多次 poll），每次 poll 都要记录。`async_tasks` 只有 `poll_result` / `error_message`，只能存最后一次。

### 2. 审计写入方式：Gateway 内部调 vs 独立端点

**选择**：`POST /api/internal/polling-audit/events` — 统一端点，支持批量写入

**理由**：
- Gateway Scheduler 内部直接调 Service 写入
- Agent Core 通过 HTTP 调同一端点写入（复用同一套落库逻辑）
- 单条和批量共用 `List<AsyncPollingAuditLog>` 入参

### 3. 响应体截断策略

复用现有 `app.gateway-audit.max-payload-bytes` 配置（默认 1MB）。超过截断后记录 `response_truncated=1`。

### 4. phase 枚举设计

| phase | 写入方 | 触发点 |
|-------|--------|--------|
| `AGENT_REQUEST` | Agent Core | `GET .../wait` 发起前 |
| `AGENT_RESPONSE` | Agent Core | `GET .../wait` 返回后 |
| `AGENT_ERROR` | Agent Core | `GET .../wait` catch |
| `GATEWAY_POLL_START` | Gateway Scheduler | `pollSingleTask` 入口 |
| `NETWORK_REQUEST` | Gateway Scheduler | `callApi` 成功后 |
| `NETWORK_ERROR` | Gateway Scheduler | `callApi` 异常 catch |
| `EVALUATION` | Gateway Scheduler | completion/failed/timeout 评估完成 |
| `GATEWAY_POLL_COMPLETE` | Gateway Scheduler | 终态写入后 |

### 5. Gateway Scheduler 审计插入点

```java
private void pollSingleTask(AsyncTask task) {
    // === GATEWAY_POLL_START ===
    AsyncPollingAuditLog startLog = buildBaseLog(task, "GATEWAY_POLL_START");
    startLog.setExtraJson(Map.of("retryCount", task.getPollRetryCount()));

    try {
        // ... startedAt / status checks ...

        Object pollResponse;
        try {
            pollResponse = apiProxyService.callApi(...);
            // === NETWORK_REQUEST ===
            auditService.log(buildNetworkLog(task, pollResponse, durationMs));
        } catch (Exception e) {
            // === NETWORK_ERROR ===
            auditService.log(buildNetworkErrorLog(task, e));
            throw e; // re-throw for retry logic
        }

        // completion check
        boolean completed = pollingService.evaluateCompletion(...);
        // failed check
        boolean isFailed = pollingService.evaluateFailure(...);
        // timeout check
        boolean expired = pollingService.isExpired(...);

        // === EVALUATION ===
        auditService.log(buildEvalLog(task, completed, isFailed, expired, actualValue));

        if (completed) { mark COMPLETED; /* === GATEWAY_POLL_COMPLETE === */ }
        else if (isFailed) { mark FAILED; /* === GATEWAY_POLL_COMPLETE === */ }
        else if (expired) { mark TIMEOUT; /* === GATEWAY_POLL_COMPLETE === */ }
        else { updateLastPolled; }

    } catch (Exception e) {
        retry / mark FAILED;
        // === GATEWAY_POLL_COMPLETE (FAILED) ===
    }
}
```

### 6. Agent Core 审计插入点

```typescript
async function executeAsyncPollingFlow(...) {
  // === AGENT_REQUEST ===
  await postAuditEvent({
    asyncTaskId, skillId, userId, sessionId,
    phase: 'AGENT_REQUEST',
    extraJson: JSON.stringify({ timeoutMs: maxWaitMs }),
  });

  try {
    const waitResponse = await axios.get(`${gatewayUrl}/api/skills/async-tasks/${asyncTaskId}/wait`, ...);

    // === AGENT_RESPONSE ===
    await postAuditEvent({
      asyncTaskId, skillId, userId, sessionId,
      phase: 'AGENT_RESPONSE',
      responseBody: JSON.stringify(waitResponse.data),
      status: waitResponse.data.status,
    });
  } catch (e) {
    // === AGENT_ERROR ===
    await postAuditEvent({
      asyncTaskId, skillId, userId, sessionId,
      phase: 'AGENT_ERROR',
      errorMessage: e.message,
      errorStack: e.stack,
    });
    throw e;
  }
}

async function postAuditEvent(log: {...}) {
  axios.post(`${gatewayUrl}/api/internal/polling-audit/events`, [log], {
    headers: gatewayApiProxyInboundHeaders(apiToken, userId, skillId),
    timeout: 5000,
  }).catch(() => {}); // audit failure never blocks business
}
```

### 7. 不阻塞业务

审计写入 `try { ... } catch {}`，失败只打一条 `log.warn`，**绝不抛异常**。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 高频轮询产生大量审计日志 | `async_polling_audit_logs` 按 `async_task_id` 索引，支持定期清理；长轮询的 scheduler 每 30s 才一次 |
| 审计写入失败不可见 | Gateway 打 `log.warn`；Agent Core 同 |
| 批量写入端点被滥用 | `/api/internal/**` 路径走 `X-Agent-Token` 鉴权 |

## Migration Plan

1. 执行 `004-async-polling-audit.sql` DDL
2. Gateway 加 `AsyncPollingAuditLog` 实体 + Mapper + Service + Controller 端点
3. Gateway `AsyncTaskPollingScheduler` 加审计插入点
4. Agent Core `executeAsyncPollingFlow` 加审计插入点
5. 编译验证 + 端到端测试

**回退方案**：删表 + 删代码，不影响轮询功能。
