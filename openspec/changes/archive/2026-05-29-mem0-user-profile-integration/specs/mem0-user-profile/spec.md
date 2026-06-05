## ADDED Requirements

### Requirement: 通过 MEM0_URL 获取用户长期画像

系统 SHALL 通过 `MemoryService.fetchUserProfile(userId)` 方法获取用户长期画像摘要，`mem0Enabled` 直接从 `process.env.MEM0_ENABLED` 实时读取。

#### Scenario: MEM0_ENABLED 为 true 时成功获取画像
- **WHEN** `process.env.MEM0_ENABLED` 解析为 true 且 `MEM0_URL` 已配置
- **AND** `context.userId` 存在
- **THEN** `fetchUserProfile(userId)` SHALL 发送 `POST {MEM0_URL}`（Content-Type: application/json）
- **AND** body 为 `{ "sentence": "梦境记忆", "userid": userId, "topk": 1 }`
- **AND** 提取 `response.data.details` 返回
- **AND** `runTask` 将 `details` 拼接到 `staticSystemPrompt` 后：`${staticSystemPrompt}[个人特征信息]${details}`

#### Scenario: 通过 MemoryController 连通性测试
- **WHEN** 开发者发起 `GET /memory/profile?userId=xxx`
- **THEN** `MemoryController` SHALL 调用 `memoryService.fetchUserProfile(userId)`
- **AND** 返回 `{ userId, details, success: boolean }` JSON

#### Scenario: MEM0_ENABLED 为 false 时
- **WHEN** `process.env.MEM0_ENABLED` 为 false
- **THEN** `fetchUserProfile` SHALL 直接返回 `""`
- **AND** `GET /memory/profile` 返回 `{ success: false }`

#### Scenario: API 失败降级
- **WHEN** POST 请求失败或 `code !== 200`
- **THEN** `fetchUserProfile` SHALL 返回 `""`
- **AND** 不阻塞主对话流程，打印 `console.error`

#### Scenario: userId 缺失
- **WHEN** `userId` 不存在
- **THEN** `fetchUserProfile` SHALL 返回 `""`，不发送请求
