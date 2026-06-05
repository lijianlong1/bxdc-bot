## Context

`agent.controller.ts` 的 `runTask` 中已有 `MemoryService.searchMemories` 做语义搜索。本次在 `MemoryService` 新增 `fetchUserProfile(userId)`，通过 `MemoryController` 暴露 HTTP 端点供测试。

`MEM0_URL` 直接作为完整请求地址。`userId` 来自 `context.userId`。

## Goals / Non-Goals

**Goals:**
- `MemoryService.fetchUserProfile(userId)` 中 `mem0Enabled` 直接从 `process.env.MEM0_ENABLED` 读取（不缓存），以便运行时动态生效
- `MemoryController` 新增 `GET /memory/profile?userId=xxx` 端点，返回画像数据用于连通性测试
- `runTask` 调用该方法并拼接 system prompt

**Non-Goals:**
- 不修改 `buildStaticSystemPrompt`、`searchMemories`

## Decisions

### Decision 1: `mem0Enabled` 从 `process.env` 实时读取

`fetchUserProfile` 内部直接从 `process.env.MEM0_ENABLED` 读取开关标志，而非依赖构造函数缓存的 `this.mem0Enabled`。理由：
- **动态生效**：修改 `.env` 后重启服务即可，无需重建 `MemoryService` 实例
- **一致性**：与 `onModuleInit` 中读取 `MEM0_URL` 的模式对齐——都在方法内读取环境变量

### Decision 2: 在 `MemoryController` 暴露测试端点

已有 `MemoryController`（`@Controller('memory')`），在其上新增 `GET /memory/profile?userId=xxx`：

```typescript
@Get('profile')
async getProfile(@Query('userId') userId: string) {
  const details = await this.memoryService.fetchUserProfile(userId);
  return { userId, details, success: !!details };
}
```

理由：
- `MemoryController` 是所有记忆相关 HTTP 操作的自然入口
- `GET` 方法可直接在浏览器、curl 中测试，无需 POST body
- 返回 `success` 字段直观表示接口是否畅通

### Decision 3: `fetchUserProfile` 方法实现

```typescript
async fetchUserProfile(userId: string): Promise<string> {
  const enabled = process.env.MEM0_ENABLED?.trim().toLowerCase();
  const isEnabled = !(enabled === 'false' || enabled === '0' || enabled === 'off');
  if (!isEnabled || !userId) return '';

  const url = process.env.MEM0_URL;
  if (!url) return '';

  try {
    const response = await axios.post(url, {
      sentence: "梦境记忆",
      userid: userId,
      topk: 1
    }, { timeout: 5000 });
    if (response.data?.code === 200 && response.data?.details) {
      return response.data.details;
    }
    return '';
  } catch (e) {
    console.error('[MemoryService] fetchUserProfile error:', e.message);
    return '';
  }
}
```

### Decision 4: `MEM0_URL` 完整地址，不拼接路径

`MEM0_URL` 值即为完整地址，不拼接任何路径后缀。

## Risks / Trade-offs

- [Risk] 每次调用都读 `process.env` 有微小性能开销 → 可忽略（每个对话只调一次）
- [Risk] `MEM0_URL` 接口响应慢 → axios timeout 5 秒降级
