## 1. Gateway — 异步轮询闭环

- [x] 1.1 在 `SkillExecutionService.execute()` 中增加异步轮询分支（`executeApiSkillAsync` 方法：发起初始请求 → 提取 taskId → 创建 async_tasks → CompletableFuture 阻塞等待）
- [x] 1.2 在 `AsyncTaskPollingScheduler` 中增加 Future 完成回调（`registerFuture` / `completeFuture` + ConcurrentHashMap）

## 2. Gateway — 异步端点下线

- [x] 2.1 删除 `POST /api/skills/api/async` 端点方法
- [x] 2.2 删除 `GET /api/skills/async-tasks/{id}/wait` 端点方法
- [x] 2.3 SecurityConfig 无需修改（方法已删除，Spring 自动不暴露）

## 3. Gateway — 执行类型注册端点

- [x] 3.1 新增 `GET /api/system-skills/execution-types`（api/ssh/template 三种类型，含 ui 字段）

## 4. Agent — 异步轮询代码删除

- [x] 4.1 删除 `executeConfiguredApiSkillAsync` 调用（dead code 保留在文件中，func 不再调用）
- [x] 4.2 删除 `postPollingAudit` 调用（dead code 保留在文件中，func 不再调用）
- [x] 4.3 删除 `executeConfiguredApiSkill` 中的 asyncPoll 分支
- [x] 4.4 import 无需清理（dead code 仍存在于文件中，编译无报错）

## 5. 前端 — ConfigFormRenderer

- [x] 5.1 新建 `ConfigFormRenderer.vue` 通用组件
  - 接收 `configSchema` prop，根据 `ui` 字段动态渲染控件
  - 支持控件类型：`input`、`select`、`keyValue`、`jsonEditor`、`textarea`、`number`
  - 支持 `aiHint` 和 `aiOptimize` 字段级提示

- [x] 5.2 修改 `SkillManagementModal.vue`
  - 删除 api/ssh/template 硬编码表单
  - 加载 `GET /api/system-skills/execution-types` 获取 schema
  - 传入 `ConfigFormRenderer` 渲染

## 6. 编译与回归测试

- [x] 6.1 Gateway 编译通过：`mvn compile` ✅
- [x] 6.2 Agent Core 编译通过：`npm run build` ✅
- [x] 6.3 前端编译通过：`npm run build` ✅
- [ ] 6.4 异步轮询 Skill：发消息 → 长时间等待 → 正确返回结果
- [ ] 6.5 异步轮询超时：发消息 → 超时 → 正确返回 TIMEOUT
- [ ] 6.6 前端配置页：新增 api/ssh/template Skill → 表单正确渲染 → 保存成功
- [ ] 6.7 前端配置页：编辑已有 Skill → 表单回填 → 修改保存
- [ ] 6.8 回归：API Skill / SSH Skill / Template Skill / 确认流 / OPENCLAW 全部正常
