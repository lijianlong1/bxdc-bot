# Design: async-fire-and-forget-periodic

## Context

扩展 API Skill 的异步调用通过 `asyncPoll` 配置启用。历史上存在两种模式：
- `SINGLE_CALL`：单次长 readTimeout 调用，无 pollEndpoint
- `PERIODIC`：标准轮询式，有 pollEndpoint

agent-core 的 `executeConfiguredApiSkillAsync`（位于 `backend/agent-core/src/tools/java-skills.ts`）负责把 LLM 工具调用转化为 gateway 异步任务，并返回结果给 LLM。

历史行为：SINGLE_CALL 立即返回；PERIODIC 同步 `await /wait`，阻塞 30s~10min。本次让 PERIODIC 同样 fire-and-forget。

## Goals / Non-Goals

**Goals:**
- PERIODIC 与 SINGLE_CALL 在用户面前体验完全一致：submit 即返回 + 通知中心后台跑
- LLM 不再被任何"等"操作卡住
- 通知中心（`/api/async-tasks/my`）立即可见 PERIODIC 任务进度

**Non-Goals:**
- 不动 gateway Scheduler（PERIODIC 轮询逻辑已经正确）
- 不动 gateway `callApiAsync` 控制器（dedup、入库、签名都正确）
- 不改前端通知中心（已支持实时轮询）
- 不引入"是否要 fire-and-forget"配置项（统一行为，避免分歧）

## Decisions

### 决策 1：PERIODIC 默认就 fire-and-forget，不加配置开关

- **选择**: 硬切 PERIODIC 到 fire-and-forget，无 `fireAndForget` 字段
- **理由**:
  - 用户明确表达"异步调用收口"——所有异步任务都不阻塞 LLM
  - 加开关会让"为什么我勾了 asyncPoll 还要等"的解释成本出现
  - 同步调用走"不带 asyncPoll"这条已有路径，PERIODIC 同步没有真实业务需求
- **替代方案**: 保留可选 `fireAndForget` 开关。否决——配置漂移成本大于收益

### 决策 2：返回 status 字符串用 "POLLING" 而非新建 "POLLING_SUBMITTED"

- **选择**: 复用现有 gateway DB 状态 "POLLING" 作为工具返回的 status
- **理由**:
  - 字符串语义对齐：任务**确实**处于 POLLING 状态
  - LLM 看到 `status: "POLLING"` 一眼就知道"任务在轮询中"，无需解释
  - 与 SINGLE_CALL 风格对齐（SINGLE_CALL 用 "SINGLE_CALLED" 是因为 DB 状态也是这个名）
- **替代方案**: 新建 "POLLING_SUBMITTED"。否决——字符串漂移，且对 LLM 没增益

### 决策 3：maxWaitMs 仅作 gateway Scheduler 兜底，agent-core 不再等待

- **选择**: 保留 `maxWaitMs` 变量计算与 audit log 记录，但 agent-core 不再传给 `/wait` 端点
- **理由**:
  - gateway Scheduler 已有自己的过期判断（`isExpired`），不需要 agent-core 同步等待配合
  - audit log 仍记 `maxWaitMs` 便于排查"为什么任务在 gateway 里被标 TIMEOUT"
- **替代方案**: 完全删除 maxWaitMs。否决——失去可观测性

### 决策 4：不动 SINGLE_CALL 分支

- SINGLE_CALL 已正确，无需修改
- 本次只替换 PERIODIC 分支，最大化降低改动面

## Risks / Trade-offs

- [行为变更：LLM 不再同步拿到 PERIODIC 任务结果] → 风险：依赖结果才能继续对话的 skill 业务方会"惊讶"。**缓解**：在 proposal 与 design 中明确"需同步等结果请改用不带 asyncPoll 的同步调用"，并由 user 团队同步给各 skill 维护者
- [前端用户在通知中心看到"刚 submit 的任务立即显示"可能误解] → 接受，状态语义"正在轮询"清晰
- [审计日志 AGENT_RESPONSE 不再记录] → 接受，agent-core 不再等结果，AGENT_RESPONSE 无内容可记；AGENT_REQUEST 已记 `fireAndForget: true` 足够排查

## Migration Plan

- 直接部署 commit `a41ec22`（已推 myfork）
- agent-core 走 nest --watch 自动热重载，无需重启
- 任何依赖 PERIODIC 同步等结果的 skill，由 user 团队评估后改：
  - 方案 A：去掉 `asyncPoll` 配置，回到同步调用
  - 方案 B：保留 `asyncPoll` 但调整产品交互（任务跑完后用户从通知中心回来继续对话）

## Open Questions

- 是否需要在 agent-core 系统提示中加一段"PERIODIC 也是 fire-and-forget"提醒，让 LLM 不要尝试再次发起相同工具调用？当前依赖 dedup 兜底（SHA-256 签名 + 1h 窗口），可能 LLM 仍会尝试重试
- 通知中心对 PERIODIC 任务的"实时进度"展示优化（当前只能看到状态变更，看不到轮询次数 / 已用时间细节）—— 留作后续 backlog
