## Context

Phase 2 完成后，Agent Core 的 `DynamicStructuredTool.func` 已统一调用 `POST /api/skills/execute`，不需要感知 HTTP 组装和执行分派。但异步轮询（`executeConfiguredApiSkillAsync`）仍然留在 Agent 侧——Agent 需要解析 `asyncPoll` 配置、调 `/api/skills/api/async`、长轮询 `GET /async-tasks/{id}/wait`。

这属于执行逻辑，应移入 Gateway，使 Agent 对 Skill 的执行方式（同步/异步）完全无感知。

前端配置页的硬编码表单阻碍了新增类型，需要改为 Schema 驱动。

## Goals

- Gateway `/execute` 内部完成异步轮询闭环，Agent 只看到一次阻塞调用
- Agent 删除所有异步轮询代码（~210 行）
- 下线 Gateway 异步端点（`/api/async` + `/async-tasks/{id}/wait`）
- 新增 `GET /api/system-skills/execution-types` 供前端动态渲染
- 前端 `ConfigFormRenderer` 替代硬编码表单

## Non-Goals

- 不修改文件系统 Skill 管理方式
- 不修改 MCP 协议
- 不修改 OPENCLAW 子规划

## Decisions

### 1. 异步轮询阻塞等待方式

**选择**：`CompletableFuture` + Scheduler 回调。

流程：
```
Agent: POST /execute { skillId, parameters }
  → SkillExecutionService: 检测 asyncPoll → 发起初始请求 → 提取 taskId
  → 创建 async_tasks 行 → 注册 CompletableFuture<fut>
  → AsyncTaskPollingScheduler: 定时轮询外部 API → 状态变更时 complete(fut)
  → SkillExecutionService: fut.get(timeout, MINUTES)
  → 返回结果
```

**理由**：复用现有 `AsyncTaskPollingScheduler` 和 `async_tasks` 表，不需要额外的轮询逻辑。CompletableFuture 比轮询 DB 的方式响应更快（状态变更立即通知）。

### 2. 超时策略

**选择**：使用 Skill 配置中的 `maxWaitSeconds`，默认 600 秒。Gateway 线程在此时间内阻塞等待。

**理由**：Tomcat 默认连接超时即可覆盖。异步调用本身就是长时间操作，阻塞一个线程是合理的。

### 3. 前端 ConfigFormRenderer 设计

**选择**：纯 Schema 驱动，每个类型一个 configSchema 对象，前端根据 `ui` 字段选择渲染控件。

configSchema 结构：
```json
{
  "type": "object",
  "properties": {
    "method": { "type": "string", "enum": ["GET","POST","PUT","DELETE"], "label": "请求方法", "required": true, "ui": "select" },
    "endpoint": { "type": "string", "label": "请求地址", "required": true, "ui": "input", "aiHint": "完整 API 地址" },
    "headers": { "type": "object", "label": "请求头", "ui": "keyValue" },
    "parameterContract": { "type": "object", "label": "参数契约", "ui": "jsonEditor", "aiOptimize": { "fieldId": "api_parameter_contract" } }
  }
}
```

支持的 `ui` 类型：`input`、`select`、`keyValue`（键值对）、`jsonEditor`、`textarea`、`number`。

**理由**：新增类型只需在 Gateway 的 `execution-types` 接口追加一个 configSchema 对象，前端零改动。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| CompletableFuture 阻塞占用 Tomcat 线程 | 异步调用本身少，600s 超时在 Tomcat 默认范围内 |
| Scheduler 与 execute 线程的 Future 映射丢失（进程重启） | 使用 `ConcurrentHashMap` 内存映射，重启后 Agent 重试即可 |
| ConfigFormRenderer 不支持复杂嵌套表单 | 初期只支持一级 properties，嵌套由 jsonEditor 兜底 |
| 前端 ConfigFormRenderer 替代现有三种表单时可能遗漏字段 | 对照现有三种表单逐字段迁移，发布前逐项验证 |

## Migration Plan

1. Gateway：实现异步轮询闭环 + execution-types 端点
2. Agent：删除异步轮询代码 + 下线异步端点调用
3. Gateway：下线异步端点
4. 前端：ConfigFormRenderer 替代硬编码表单
5. 全链路回归测试
