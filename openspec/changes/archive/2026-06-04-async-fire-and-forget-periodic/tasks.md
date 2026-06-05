# Tasks: async-fire-and-forget-periodic

## 1. agent-core executeConfiguredApiSkillAsync PERIODIC 分支改造

- [x] 1.1 删除 PERIODIC 分支的 `await axios.get(/api/skills/async-tasks/{id}/wait)` 调用（约 8 行）
- [x] 1.2 删除 PERIODIC 分支的 4 个 status 判断（COMPLETED/FAILED/TIMEOUT/POLLING hint，约 50 行）
- [x] 1.3 删除 PERIODIC 分支的 AGENT_RESPONSE audit log（agent-core 不再等结果，无内容可记）
- [x] 1.4 替换为 fire-and-forget 返回：`{ asyncTaskId, externalTaskId, status: "POLLING", note: "..." }`
- [x] 1.5 保留 maxWaitMs 变量计算与 AGENT_REQUEST audit log（标记 `fireAndForget: true` + `pollStrategy: "PERIODIC"`）
- [x] 1.6 SINGLE_CALL 分支保持不变（已正确）

## 2. 验证

- [x] V.1 `npx tsc --noEmit` 通过（agent-core TS 编译无错）
- [x] V.2 agent-core 自动热重载并跑新代码（PID 5658, 端口 3000）
- [x] V.3 PERIODIC 模式 submit 后 gateway DB 任务入库（status=POLLING），agent-core 立即返回 status="POLLING"
- [x] V.4 通知中心 `/api/async-tasks/my` 立即可见 PERIODIC 任务（无需等待完成）
- [x] V.5 LLM 收到 status="POLLING" + note 后能正确告诉用户"任务在后台处理"
- [x] V.6 SINGLE_CALL 行为不变（沿用既有逻辑）

## 3. 提交 & 推送

- [x] 3.1 本地 commit `a41ec22` `feat(async): 异步调用收口 —— PERIODIC 也走"立即返回 + 通知中心"模式`
- [x] 3.2 推送到 myfork `low-version` 分支：`c5c2888..a41ec22`
