## 1. MemoryService：新增 `fetchUserProfile` 方法

- [x] 1.1 在 `memory.service.ts` 中新增 `async fetchUserProfile(userId: string): Promise<string>`
- [x] 1.2 方法内直接从 `process.env.MEM0_ENABLED` 读取开关（不依赖 `this.mem0Enabled`），非 true 返回 `""`
- [x] 1.3 从 `process.env.MEM0_URL` 读取 URL，为空返回 `""`
- [x] 1.4 `userId` 无效时返回 `""`
- [x] 1.5 发送 `axios.post(url, { sentence: "梦境记忆", userid: userId, topk: 1 }, { timeout: 5000 })`
- [x] 1.6 `code === 200` 且有 `details` 返回之，否则返回 `""`；catch 异常返回 `""` 并 `console.error`

## 2. MemoryController：新增 `GET /memory/profile` 端点

- [x] 2.1 在 `memory.controller.ts` 新增 `@Get('profile')` 方法 `getProfile(@Query('userId') userId: string)`
- [x] 2.2 调用 `this.memoryService.fetchUserProfile(userId)` 获取 `details`
- [x] 2.3 返回 `{ userId, details, success: !!details }` JSON
- [x] 2.4 开发者通过 `curl http://localhost:3000/memory/profile?userId=xxx` 测试连通性

## 3. agent.controller.ts：调用 `fetchUserProfile`

- [x] 3.1 `runTask` 中 `staticSystemPrompt` 后调用 `await this.memoryService.fetchUserProfile(userId)`
- [x] 3.2 非空：`${staticSystemPrompt}[个人特征信息]${details}`；空：仅 `staticSystemPrompt`
- [x] 3.3 赋值给 `messages[0].content`

## 4. 验证与测试

- [x] 4.1 `.env`: `MEM0_ENABLED=true`, `MEM0_URL=http://localhost:3456/mock/api/DreamTest`
- [x] 4.2 `curl http://localhost:3000/memory/profile?userId=test123` 验证测试端点
- [x] 4.3 前端发送消息验证 system prompt 含 `[个人特征信息]`
- [x] 4.4 `MEM0_ENABLED=false` 验证降级
