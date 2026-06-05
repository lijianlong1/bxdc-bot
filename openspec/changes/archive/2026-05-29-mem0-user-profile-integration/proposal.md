## Why

当 `MEM0_ENABLED=true` 时，agent-core 已通过 mem0 服务做语义搜索记忆注入，但缺少一个独立的「用户画像/长期记忆摘要」接口来提供用户长期特征信息。需要新增一个基于 `MEM0_URL` 的 POST 请求获取用户画像数据，并将其拼接到系统提示词中，使 LLM 能感知用户的长期画像信息。

## What Changes

- **在 `MemoryService` 中新增 `fetchUserProfile(userId)` 方法**：封装对 `MEM0_URL` 的 POST 请求（payload: `{ "sentence": "梦境记忆", "userid": userId, "topk": 1 }`），`mem0Enabled` 直接从 `process.env.MEM0_ENABLED` 读取而非构造函数缓存。
- **在 `MemoryController` 中新增 `GET /memory/profile?userId=xxx` 端点**：供开发者通过 HTTP 调用 `/memory/profile` 测试记忆接口是否畅通（连通性测试）。端点内部调用 `this.memoryService.fetchUserProfile(userId)`。
- **修改 `agent.controller.ts` 的 `runTask` 方法**：调用 `this.memoryService.fetchUserProfile(userId)` 获取画像，拼接到 `staticSystemPrompt` 后面。
- 若 `MEM0_ENABLED=false`，行为不变——system 消息的 `content` 仅包含 `staticSystemPrompt`。

## Capabilities

### New Capabilities

- `mem0-user-profile`: 在 `MemoryService` 中封装 `fetchUserProfile(userId)` 方法（`mem0Enabled` 从 `process.env` 实时读取）；在 `MemoryController` 中暴露 `GET /memory/profile` 端点供连通性测试。

### Modified Capabilities

- `mem0-integration`: 新增用户画像 POST 获取能力，`MEM0_ENABLED` 同时控制此功能。

## Impact

- **Affected code**:
  - `backend/agent-core/src/mem/memory.service.ts`：新增 `fetchUserProfile(userId)` 方法
  - `backend/agent-core/src/controller/memory.controller.ts`：新增 `GET /memory/profile` 端点
  - `backend/agent-core/src/controller/agent.controller.ts`：`runTask` 调用 `fetchUserProfile`
- **Affected env**: `.env` 中的 `MEM0_ENABLED`、`MEM0_URL`（测试值 `http://localhost:3456/mock/api/DreamTest`）
- **No breaking changes**
