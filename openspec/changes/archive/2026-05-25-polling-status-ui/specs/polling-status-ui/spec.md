# polling-status-ui Specification

## Purpose

约定异步轮询 Skill 执行期间，SSE 心跳携带实时轮询进度，前端以工具调用卡片形式展示轮询状态、耗时和最近一次轮询返回内容。

## ADDED Requirements

### Requirement: SSE 心跳携带轮询进度

skill-gateway 的 SSE 心跳回调 SHALL 查询当前会话关联的异步轮询任务，并发送结构化 `polling_status` 事件替代空注释。

#### Scenario: 心跳发送轮询状态

- **WHEN** 当前会话存在 `status` 为 `POLLING` 或 `PENDING` 的异步任务
- **THEN** 每次心跳（30s 间隔）SHALL 发送 `event: polling_status` SSE 事件
- **AND** 事件 data SHALL 为 JSON，包含以下字段：
  - `asyncTaskId`（Long）：异步任务 ID
  - `externalTaskId`（String/null）：上游 API 返回的外部任务 ID
  - `status`（String）：当前状态（`PENDING` / `POLLING`）
  - `retryCount`（Integer）：已重试次数（含当前轮）
  - `elapsedSeconds`（Long）：自任务启动以来的已耗时秒数
  - `lastPollResponse`（String/null）：最后一次轮询返回内容的截断文本（最长 500 字符）
- **AND** `lastPollResponse` SHALL 做 JSON 格式化美化后截断（如内容为合法 JSON）

#### Scenario: 服务端如何获取最后一次轮询内容

- **WHEN** 需要发送最后一次轮询的返回内容
- **THEN** SHALL 从 `AsyncPollingAuditLog` 表中最近一条 `phase=NETWORK_REQUEST` 的 `response_body` 字段读取
- **AND** 若不存在则 `lastPollResponse` 为 `null`

#### Scenario: 会话无异步任务

- **WHEN** 当前会话关联的异步任务均已结束或不存在
- **THEN** 心跳 SHALL 回退为发送空注释（`:`）用于保活
- **AND** SHALL NOT 发送 `polling_status` 事件

#### Scenario: 多个异步任务

- **WHEN** 当前会话关联了多个活跃的异步任务
- **THEN** `polling_status` 事件的 `tasks` 字段 SHALL 为数组，每项一个任务的信息
- **AND** 数组 SHALL 按 `started_at` 升序排列

### Requirement: 查询异步任务

skill-gateway SHALL 提供按会话 ID 查询活跃异步任务的能力。

#### Scenario: AsyncTaskMapper 查询

- **WHEN** 调用 `AsyncTaskMapper.findBySessionId(sessionId)`
- **THEN** SHALL 返回该会话下所有 `status` 为 `PENDING` 或 `POLLING` 的 `AsyncTask` 列表
- **AND** SHALL 按 `created_at` 升序排列

### Requirement: 前端处理 polling_status 事件

前端 `useChat.ts` SHALL 处理 `polling_status` SSE 事件，更新对应工具调用的实时进度。

#### Scenario: 识别 polling_status 事件

- **WHEN** `EventSource.onmessage` 接收到 JSON 数据
- **THEN** 若 `data.type === "polling_status"` SHALL 进入 `polling_status` 处理分支
- **AND** SHALL NOT 影响其他事件类型的处理（`llm_log`、`tool_status`、`agent_message` 等）

#### Scenario: 更新工具调用状态

- **WHEN** 收到 `polling_status` 事件
- **THEN** SHALL 找到对应 `toolId` 为 `async_{asyncTaskId}` 格式的 `ToolInvocation`
- **AND** 若不存在该 ToolInvocation，SHALL 新建一个 `kind: "skill"`、`status: "running"` 的工具调用条目
- **AND** 更新该 ToolInvocation 的 `pollingStatus` 字段为：
  - `status`：轮询状态（`PENDING` / `POLLING`）
  - `retryCount`：重试次数
  - `elapsedSeconds`：已耗时
  - `lastPollResponsePreview`：最近响应预览（最多 200 字符）

### Requirement: 前端轮询进度展示

工具调用卡片在轮询进行中时 SHALL 展示实时轮询进度信息。

#### Scenario: 轮询中卡片内容

- **WHEN** ToolInvocation 的 `pollingStatus` 不为空且 `pollingStatus.status !== "COMPLETED"`
- **THEN** 工具调用卡片 SHALL 额外展示：
  - 状态标签：`轮询中 (第 N 次)` 或 `等待首次轮询`
  - 已耗时：`mm:ss` 格式
  - 最近响应：可折叠的响应内容预览（最多 200 字符）

#### Scenario: 轮询完成卡片收敛

- **WHEN** ToolInvocation 的 `status` 变为 `"completed"` 或 `"failed"`
- **THEN** 轮询进度信息 SHALL 被最终结果覆盖
- **AND** `pollingStatus` SHALL 被清空
- **AND** 最终 `result`（`tool_status completed` 携带的）SHALL 展示在卡片中

#### Scenario: 轮询失败提示

- **WHEN** ToolInvocation 的 `status` 变为 `"failed"` 且 `errorMessage` 不为空
- **THEN** 卡片 SHALL 展示失败原因
- **AND** 轮询进度信息 SHALL 保留为展开态供排查

### Requirement: 零依赖新增

此变更 SHALL NOT 引入任何新的 npm 或 Maven 依赖。

#### Scenario: skill-gateway 不引入新依赖

- **WHEN** 实现轮询进度查询与心跳发送
- **THEN** SHALL 复用现有 `AsyncTaskPollingService` / `AsyncPollingAuditService` 查询数据
- **AND** SHALL NOT 在 `pom.xml` 中新增任何 `<dependency>`

#### Scenario: 前端不引入新依赖

- **WHEN** 实现轮询进度 UI 展示
- **THEN** SHALL 复用现有 TDesign 组件（`t-tag`、`t-collapse` 等）
- **AND** SHALL NOT 安装任何新的 npm 包
