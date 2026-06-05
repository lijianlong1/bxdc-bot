## ADDED Requirements

### Requirement: 获取用户长期画像摘要

系统 SHALL 在 `MemoryService` 中提供 `fetchUserProfile(userId)` 方法，`mem0Enabled` 从 `process.env.MEM0_ENABLED` 实时读取；并在 `MemoryController` 暴露 `GET /memory/profile` 端点。

#### Scenario: 方法封装与可测试性
- **WHEN** `process.env.MEM0_ENABLED` 为 true 且 `MemoryService` 实例可用
- **THEN** `fetchUserProfile(userId)` SHALL 发送 `POST {MEM0_URL}`（Content-Type: application/json）
- **AND** body 为 `{ "sentence": "梦境记忆", "userid": userId, "topk": 1 }`
- **AND** 返回 `details` 字段，失败返回 `""`

#### Scenario: HTTP 端点测试连通性
- **WHEN** 发起 `GET /memory/profile?userId=xxx`
- **THEN** `MemoryController` SHALL 委托 `memoryService.fetchUserProfile(userId)` 并返回 `{ userId, details, success }` JSON

#### Scenario: 注入系统提示词
- **WHEN** `runTask` 调用 `fetchUserProfile(userId)` 获取到非空 `details`
- **THEN** SHALL 拼接 `${staticSystemPrompt}[个人特征信息]${details}` 作为 system 消息 content
