# API Skill 上游接口要求

本文档说明配置 API Skill（尤其是异步轮询模式）时，上游 HTTP API 需要满足的接口约定。

---

## 同步模式（仅 `timeoutSeconds`）

**无特殊要求。** 上游 API 只需在配置的超时时间内返回 HTTP 响应即可。

`timeoutSeconds` 同时控制 Agent Core → Gateway 和 Gateway → 上游 API 两段超时：

- 默认 30 秒
- 范围 1 ~ 3600 秒（1 小时）
- 超时未返回 → 系统向 LLM 返回结构化超时错误

---

## 异步轮询模式（`asyncPoll`）

异步轮询适用于**提交任务后需要轮询结果**的上游 API，例如批量任务、数据导出、异步报表等场景。

上游 API 必须遵循 **"提交任务 → 返回 task_id → 轮询状态端点"** 的异步模式，分两步：

### 第一步：初始请求（提交任务）

**要求：初始响应必须是 JSON，且包含可提取的任务标识符。**

| 要求 | 说明 |
|------|------|
| 响应格式 | JSON |
| 包含字段 | 一个可唯一标识本次任务的 ID（如 `task_id`、`job_id`） |
| ID 位置 | 通过 JSON Path 可定位（如 `data.task_id`、`id`） |

**通过的标准：**

初始响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "job-abc123"
  }
}
```

对应配置 `idJsonPath: "data.task_id"`，系统提取到 `job-abc123`。

**不通过的情况：**

- 响应不是 JSON（纯文本、HTML 等）
- 响应是 JSON 但没有任务 ID 字段
- 任务 ID 位于嵌套数组 / 动态 key 中（当前仅支持 `a.b.c` 点号路径）

如果不通过，系统**不会创建异步任务**，直接向 LLM 返回错误。

---

### 第二步：轮询请求（查询任务状态）

**要求：上游 API 必须提供一个独立的状态查询端点，响应中包含可读的状态字段。**

| 要求 | 对应配置 | 说明 |
|------|---------|------|
| 独立查询端点 | `pollEndpoint` | URL 模板，`{id}` 会被替换为提取到的任务 ID |
| 状态字段 | `completionJsonPath` | JSON Path，定位轮询响应中的状态字段 |
| 完成判定值 | `completionValue` | 状态字段等于该值（大小写不敏感）→ 任务完成 |
| 失败判定值（可选） | `failedValues` | 状态字段匹配列表中任一值 → 任务失败 |
| 结果字段（可选） | `resultJsonPath` | JSON Path，提取最终结果返回给 LLM。未配置时返回完整响应 |

**轮询响应示例：**

```json
// 进行中 —— 继续轮询
{ "status": "processing" }

// 已完成 —— 结束，提取结果
{ "status": "completed", "result": { "output": "...", "rows": 1000 } }

// 已失败 —— 结束，返回错误
{ "status": "failed", "error": "insufficient permissions" }
```

对应配置：

```json
{
  "asyncPoll": {
    "pollEndpoint": "https://api.example.com/tasks/{id}/status",
    "idJsonPath": "data.task_id",
    "completionJsonPath": "status",
    "completionValue": "completed",
    "failedValues": ["failed", "error"],
    "resultJsonPath": "result"
  }
}
```

---

## 完整配置示例

以下是一个生产环境可用的 API Skill 异步轮询配置：

```json
{
  "kind": "api",
  "method": "POST",
  "endpoint": "https://api.example.com/exports",
  "headers": {
    "Authorization": "Bearer {{token}}",
    "Content-Type": "application/json"
  },
  "timeoutSeconds": 60,
  "asyncPoll": {
    "pollEndpoint": "https://api.example.com/exports/{id}/status",
    "idJsonPath": "id",
    "pollMethod": "GET",
    "pollIntervalSeconds": 10,
    "maxWaitSeconds": 1800,
    "completionJsonPath": "state",
    "completionValue": "done",
    "failedValues": ["cancelled", "expired"],
    "resultJsonPath": "download_url",
    "pollHeaders": {
      "Authorization": "Bearer {{token}}"
    }
  }
}
```

参数说明：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeoutSeconds` | number | 30 | 初始请求的 HTTP 超时（秒） |
| `asyncPoll.pollEndpoint` | string | **必填** | 轮询 URL 模板，`{id}` 占位符 |
| `asyncPoll.idJsonPath` | string | - | 从初始响应提取任务 ID 的 JSON Path |
| `asyncPoll.pollMethod` | string | `GET` | 轮询请求的 HTTP 方法 |
| `asyncPoll.pollIntervalSeconds` | number | 5 | 轮询间隔（秒） |
| `asyncPoll.maxWaitSeconds` | number | 600 | 最大等待时间（秒），超时标记为 TIMEOUT |
| `asyncPoll.completionJsonPath` | string | - | 判定完成的状态字段路径 |
| `asyncPoll.completionValue` | string | - | 完成时的状态值 |
| `asyncPoll.failedValues` | string[] | - | 失败时的状态值列表（任一匹配即失败） |
| `asyncPoll.resultJsonPath` | string | - | 提取最终结果的 JSON Path |
| `asyncPoll.pollHeaders` | object | - | 轮询请求额外 headers（鉴权等） |

---

## 不适用异步轮询的场景

以下场景**不适合**用当前的异步轮询模式：

| 场景 | 原因 | 替代建议 |
|------|------|----------|
| 上游通过 WebSocket 推送结果 | 无 HTTP 轮询端点 | 需要 WebSocket 支持（未实现） |
| 上游通过 callback URL 通知 | 推送模式，不主动查询 | 需要 callback 接收端点（未实现） |
| 轮询响应是 HTML 页面 | 无法用 JSON Path 提取状态 | 需要 HTML 解析或上游提供 JSON 接口 |
| 任务 ID 在响应数组/嵌套结构中 | JSON Path 仅支持 `a.b.c` 点号路径 | 需要上游调整响应结构 |
| 需要长时间持有连接（SSE） | 轮询模式是短连接 | 需要 SSE 支持（未实现） |
