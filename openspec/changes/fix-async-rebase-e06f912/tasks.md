# Tasks — fix-async-rebase-e06f912

## 1. 备份原状态
- [x] 1.1 创建备份 tag `backup/pre-rebase-20260609-090349` 指向原 low-version HEAD (8cd8dc7)

## 2. 新建 rebase-clean 分支
- [x] 2.1 `git checkout -b rebase-clean e06f912` 从 pre-merge tip 创建分支
- [x] 2.2 验证 AsyncTaskPollingScheduler.java 行数 (388) 与 java-skills.ts asyncPoll Submit (`if (config.asyncPoll)`) 存在

## 3. Cherry-pick 10 个 non-merge commit
- [x] 3.1 cherry-pick dc0302e refactor: 技能系统统一执行重构
- [x] 3.2 cherry-pick fe33256 docs: 合并方案文档
- [x] 3.3 cherry-pick fd42f5e docs: 合并报告 - low-version ← hebing
- [x] 3.4 cherry-pick f181829 docs: 合并测试清单
- [x] 3.5 cherry-pick ddddff5 chore(skill-gateway): .m2 仓库 + settings.xml
- [x] 3.6 cherry-pick 14cf8e8 docs: 更新测试清单
- [x] 3.7 cherry-pick c70b80d fix(schema): 移除 async_tasks session_id 索引
- [x] 3.8 cherry-pick 8d158f1 chore: 将建表语句集中到 sql/ 目录
- [x] 3.9 cherry-pick 9e96a9c feat(skill-editor): SINGLE_CALL 策略 UI
- [x] 3.10 cherry-pick e94cd9e fix(frontend): useChat types

## 4. 解决 cherry-pick 冲突

### 4.1 dc0302e refactor 冲突（5 处）
- [x] 4.1.1 AsyncTaskPollingScheduler.java → ours (e06f912 388 行版本)
- [x] 4.1.2 java-skills.ts（4 处冲突区，最大 832 行） → ours (e06f912 asyncPoll Submit)
- [x] 4.1.3 SkillController.java → theirs (dc0302e 统一执行入口)
- [x] 4.1.4 SkillManagementModal.vue → theirs (dc0302e schema 驱动渲染)
- [x] 4.1.5 useChat.ts → theirs (dc0302e，后续 e94cd9e 再补 sessionId)
- [x] 4.1.6 清理 frontend/dist/* 与 agent-core/dist/* 冲突（AGENTS.md 1: dist 不进 git）

### 4.2 整合冲突（fix(async) commit 9ee3b6c）
- [x] 4.2.1 SkillExecutionService.executeApiSkillAsync 改写为 fire-and-forget（移除 registerFuture + future.get）
- [x] 4.2.2 java-skills.ts 加 14 个 `export` 关键字（formatToolError / GatewaySkill / parseSkillConfig 等）
- [x] 4.2.3 loadGatewayExtendedTools options 加 `sessionId?: string` 字段
- [x] 4.2.4 agent.ts 撤销临时 `as any` hack，恢复类型安全

## 5. 验证 build
- [x] 5.1 frontend `npm run build` → 0 errors
- [x] 5.2 skill-gateway `mvn compile` → BUILD SUCCESS
- [x] 5.3 agent-core `npx tsc --noEmit` → exit=0

## 6. 运行测试
- [x] 6.1 agent-core 6 个测试（java-skills.loader / skill-manager-routing / tasks-state / prompts-static-system / history-sanitize / logger.service）→ 全通过
- [ ] 6.2 skill-gateway 12 个 Java 测试 → ⏸️ maven-surefire-plugin 不在 .m2，本地离线无法下载（环境限制，待用户 push 后内网 CI 跑）

## 7. 重启服务 + 端到端探活
- [x] 7.1 kill 旧的 3 个服务（18080/3000/5173）
- [x] 7.2 启动新的 3 个服务
- [x] 7.3 探活 18080/3000/5173 → 全 LISTENING
- [x] 7.4 端到端 `/api/skills` (X-User-Id: 151515) → 200，2 skills
- [x] 7.5 端到端 `/api/async-tasks/my` (3 个用户) → 全 200
- [x] 7.6 端到端 `/api/skills/execute` POST → 57ms 响应（fire-and-forget 路径）

## 8. fast-forward low-version
- [x] 8.1 `git checkout low-version`
- [x] 8.2 `git reset --hard rebase-clean` (线性化历史)
- [x] 8.3 验证 low-version HEAD = 9ee3b6c

## 9. 文档
- [x] 9.1 创建 `docs/merge-report-rebase-async-fix.md` 合并报告
- [x] 9.2 创建 `openspec/changes/fix-async-rebase-e06f912/` (proposal / specs / design / tasks)

## 10. Push myfork（用户手动）
- [ ] 10.1 `git push myfork low-version --force`（GitHub 网络慢，本会话期间多次超时，推迟到用户手动执行）

## 11. 归档 OpenSpec change
- [ ] 11.1 push 后跑 `npx openspec archive fix-async-rebase-e06f912 -y`（依赖 10.1 push 完成）
