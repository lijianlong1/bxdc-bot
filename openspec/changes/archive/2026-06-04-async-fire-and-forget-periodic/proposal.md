# Change: async-fire-and-forget-periodic

## Why

之前 PERIODIC 模式（有 pollEndpoint 的轮询式异步 API 任务）会在 agent-core 的 `executeConfiguredApiSkillAsync` 里同步 `await /wait` 端点阻塞 30s~10min，LLM 在这段时间完全卡住、用户前端对话窗口出现"转圈圈"。SINGLE_CALL 模式已经是 fire-and-forget（立即返回、通知中心后台跑），但 PERIODIC 仍走同步等待，体验不一致。

本次把 PERIODIC 改成与 SINGLE_CALL 相同的"submit 即返回"模式，两种异步模式在用户面前**行为完全一致**：submit → 立即返回 status + note → 通知中心后台跑 → 结果推送到通知铃铛。LLM 不再被任何"等"操作卡住。

## What Changes

- **modified(agent-core)**: `executeConfiguredApiSkillAsync` 的 PERIODIC 分支改为 fire-and-forget：
  - 移除 `await axios.get(/api/skills/async-tasks/${id}/wait)`
  - 移除 PERIODIC 路径上的 4 个 status 分支判断（COMPLETED/FAILED/TIMEOUT/POLLING hint）
  - 改为返回 `{ asyncTaskId, externalTaskId, status: "POLLING", note: "..." }` —— 与 SINGLE_CALL 同形
  - audit log 标记 `pollStrategy: "PERIODIC"` + `fireAndForget: true`

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `api-extension-skill-llm-tool-call`: 新增"异步任务必须 fire-and-forget 立即返回"的 REQUIREMENT，覆盖原 PERIODIC 同步等待的隐含行为

## Impact

- **修改文件**:
  - `backend/agent-core/src/tools/java-skills.ts`（executeConfiguredApiSkillAsync，约 70 行 PERIODIC 同步代码删除，约 20 行 fire-and-forget 替换）
- **新增依赖**: 无
- **行为变更**: 之前 PERIODIC 同步等结果时 LLM 能拿 COMPLETED 的 result 一次性给完整答案；现在 LLM 只能告诉用户"任务在后台跑"，结果通过通知中心推送
- **下游业务方**: 如果有 skill 业务方需要等结果才能继续对话，需改成同步调用（不带 asyncPoll）
- **关联提交**: commit `a41ec22` `feat(async): 异步调用收口 —— PERIODIC 也走"立即返回 + 通知中心"模式`
