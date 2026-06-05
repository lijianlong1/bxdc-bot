## 1. 配置与环境准备

- [x] 1.1 在 `backend/agent-core/.env` 中添加 `MEM0_URL=http://39.104.81.41:8001`
- [x] 1.2 确保 `backend/agent-core` 已安装 `axios` 依赖

## 2. 核心逻辑实现

- [x] 2.1 修改 `backend/agent-core/src/mem/memory.service.ts`，引入 `axios` 并配置 `MEM0_URL`
- [x] 2.2 在 `MemoryService` 中实现 `searchMemories` 方法，调用 `mem0` 的 `/msearch` 接口
- [x] 2.3 在 `MemoryService` 中实现 `processTurn` 方法，调用 `mem0` 的 `/madd` 接口
- [x] 2.4 确保 `MemoryService` 中的方法正确处理 `userId` 参数
- [x] 2.5 在 `MemoryService` 中添加错误处理逻辑，确保 `mem0` 服务不可用时 Agent 仍能运行

## 3. 集成与清理

- [x] 3.1 更新 `backend/agent-core/src/controller/agent.controller.ts`，确保其调用更新后的 `MemoryService` 方法
- [x] 3.2 (可选) 如果不再需要本地 SQLite 存储，清理 `memories.db` 相关代码和文件
- [x] 3.3 验证 Agent 是否能通过 `mem0` 服务正确检索和存储长短期记忆
