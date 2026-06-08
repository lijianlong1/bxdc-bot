# 合并后测试清单：low-version ← hebing

> 合并提交：`963c484` | 报告文档：`docs/merge-report-low-version-hebing.md`

---

## 一、构建验证（P0 - 必须先通过）

合并后 dist/ 已从 git 移除，需重新构建确认无误。

| # | 测试项 | 命令 | 预期 |
|---|--------|------|------|
| 1.1 | agent-core 编译 | `cd backend/agent-core && npm run build` | ✅ PASS — 无 TypeScript 错误，dist/ 生成成功 |
| 1.2 | skill-gateway 编译 | `./apache-maven-3.9.6/bin/mvn compile` (实际路径: `/Users/yangkai/Downloads/maven/apache-maven-3.9.11/bin/mvn`) | ✅ PASS — BUILD SUCCESS |
| 1.3 | frontend 编译 | `cd frontend && npm run build` | ❌ FAIL — 2 个 TS 错误（合并接口不兼容，见下方 Notes） |

---

## 二、现有单元测试（P1 - 验证无回归）

| # | 模块 | 测试文件 | 命令 |
|---|------|---------|------|
| 2.1 | agent-core | `java-skills.loader.test.cjs` | ❌ FAIL — 20 测试 0 通过（缺少 `pinyin-pro` 依赖，需 `npm install`） |
| 2.2 | agent-core | `skill-manager-routing.test.cjs` | ❌ FAIL — MODULE_NOT_FOUND（依赖缺失） |
| 2.3 | agent-core | `tasks-state.test.cjs` | ❌ FAIL — MODULE_NOT_FOUND（依赖缺失） |
| 2.4 | agent-core | `history-sanitize.test.cjs` | ✅ PASS — 4/4 通过 |
| 2.5 | agent-core | `logger.service.test.cjs` | ❌ FAIL — MODULE_NOT_FOUND（依赖缺失） |
| 2.6 | agent-core | `prompts-static-system.test.cjs` | ❌ FAIL — MODULE_NOT_FOUND（依赖缺失） |
| 2.7 | skill-gateway | `SkillGatewayApplicationTests.java` | ⚠️ SKIP — 未运行（需启动 MySQL，不便在本环境执行） |
| 2.8 | frontend | `fileValidator.test.ts` | ✅ PASS |
| 2.9 | frontend | `llmLog.test.ts` | ✅ PASS |
| 2.10 | frontend | `skillEditor.test.ts` | ✅ PASS |
| 2.11 | frontend | `toolInvocationUtils.test.ts` | ✅ PASS |
| 2.12 | frontend | `twemojiAvatar.test.ts` | ✅ PASS |

---

## 三、low-version 重构核心功能（P1 - 绝不能回归）

### 3.1 Skill 统一执行（Gateway 端）

| # | 测试场景 | 操作 | 验证点 |
|---|---------|------|--------|
| 3.1.1 | API Skill 执行 | 调用 `POST /api/skills/execute`（kind: api） | `SkillExecutionService.execute()` 正确路由到 `ApiProxyService` |
| 3.1.2 | SSH Skill 执行 | 调用 `POST /api/skills/execute`（kind: ssh） | SSH 扩展技能通过统一入口执行 |
| 3.1.3 | Template Skill 执行 | 调用 `POST /api/skills/execute`（kind: template） | 模板技能正确渲染 |
| 3.1.4 | 技能确认机制 | 调用需确认的技能 | `PendingConfirmationStore` 写入挂起确认，用户确认后恢复执行 |
| 3.1.5 | SystemSkillController | 调用系统技能管理接口 | 统一管理入口正常工作 |

### 3.2 agent-core 工具拆分

| # | 测试场景 | 验证点 |
|---|---------|--------|
| 3.2.1 | JavaComputeTool | 数学计算工具正常（加减乘除、阶乘等） |
| 3.2.2 | JavaServerLookupTool | 服务器查询工具正常 |
| 3.2.3 | Skill Generator | `skill-generator.ts` 模板化生成正常 |
| 3.2.4 | OPENCLAW Executor | `openclaw-executor.ts` SSH 执行器正常 |
| 3.2.5 | 旧工具已移除 | 确认 `JavaSshTool`、`JavaLinuxScriptTool`、旧 `JavaSkillGeneratorTool` 不存在于 `java-skills.ts` |

### 3.3 异步轮询 (SSE)

| # | 测试场景 | 操作 | 验证点 |
|---|---------|------|--------|
| 3.3.1 | 轮询进度展示 | 触发异步任务 | 前端收到 `polling_status` SSE 事件并展示进度 |
| 3.3.2 | SSE 稳定性 | 长时间保持连接 | `complete` 事件正常触发，`error` 事件有日志 |
| 3.3.3 | pollHeaders 反序列化 | 异常 headers 场景 | warn 级别日志而非报错崩溃 |

---

## 四、hebing 合入的新功能（P1 - 需验证可用）

### 4.1 文件上传

| # | 测试场景 | 操作 | 预期 |
|---|---------|------|------|
| 4.1.1 | 上传 txt 文件 | 聊天框上传 `.txt` | 正确解析文本内容 |
| 4.1.2 | 上传 docx 文件 | 聊天框上传 `.docx` | 通过 Gateway `WordParserController` 解析 |
| 4.1.3 | 上传 xlsx 文件 | 聊天框上传 `.xlsx` | 通过 `ExcelParserController` 解析 |
| 4.1.4 | 上传 ppt 文件 | 聊天框上传 `.pptx` | 通过 `PptParserController` 解析 |
| 4.1.5 | 上传 md 文件 | 聊天框上传 `.md` | 正确解析 Markdown |
| 4.1.6 | 文件大小校验 | 上传超大文件 | `fileValidator` 拒绝并给出提示 |
| 4.1.7 | 不支持格式 | 上传 `.exe` / `.bin` | 拒绝并提示不支持的格式 |

### 4.2 异步通知中心

| # | 测试场景 | 操作 | 预期 |
|---|---------|------|------|
| 4.2.1 | 任务完成通知 | 触发异步任务后等待 | 右上角 `TaskNotificationBell` 显示通知数量 |
| 4.2.2 | 通知列表 | 点击通知铃铛 | `GET /api/async-tasks/my` 返回任务列表 |
| 4.2.3 | 通知刷新 | 轮询刷新 | 新任务出现在列表中 |

### 4.3 ThinkingMode

| # | 测试场景 | 操作 | 预期 |
|---|---------|------|------|
| 4.3.1 | 开启思考模式 | 发送消息 | 展示 `ThinkingMode` 组件的思考过程 |
| 4.3.2 | 关闭思考模式 | 切换开关 | 不展示思考过程，直接显示结果 |
| 4.3.3 | 文案显示 | 观察文案 | 显示"调用过程"而非"思考模式"（已重命名） |

### 4.4 对话记录

| # | 测试场景 | 操作 | 预期 |
|---|---------|------|------|
| 4.4.1 | ConversationLog 写入 | 发送对话 | `conversation_log` 表有记录 |
| 4.4.2 | ToolCallLog 写入 | 调用工具 | `tool_call_log` 表有记录 |
| 4.4.3 | 下载 MD | 点击下载 MD | 生成 Markdown 格式对话记录 |
| 4.4.4 | 下载 PDF | 点击下载 PDF | 生成 PDF 格式对话记录 |

### 4.5 其他功能

| # | 测试场景 | 验证点 |
|---|---------|--------|
| 4.5.1 | mem0 用户画像 | 多次对话后用户画像数据积累 |
| 4.5.2 | LLM 流式响应 | 设置 `AGENT_STREAMING=false`，验证非流式响应正常 |
| 4.5.3 | CORS 安全 | 从非白名单域名访问，确认被拒绝 |

---

## 五、集成测试（P2 - 端到端流程）

| # | 场景 | 操作步骤 | 预期 |
|---|------|---------|------|
| 5.1 | **完整聊天流程** | 1. 打开前端 2. 输入消息 3. 等待 LLM 回复 | 消息正确发送/接收，SSE 流式展示 |
| 5.2 | **文件上传 + 对话** | 1. 上传 docx 文件 2. 问 LLM "总结文件内容" | 文件正确解析，LLM 基于文件内容回答 |
| 5.3 | **Skill 调用流程** | 1. 输入触发 Skill 的消息 2. 确认执行 3. 查看结果 | Skill 正确加载、执行、返回结果 |
| 5.4 | **异步任务轮询** | 1. 触发异步 API Skill 2. 观察进度展示 3. 等待完成 | 进度实时更新，通知中心有新通知 |
| 5.5 | **用户设置** | 1. 打开 Settings 2. 修改 LLM 参数 3. 开启/关闭 ThinkingMode | 设置正确保存并生效 |
| 5.6 | **用户注册登录** | 1. 系统密码注册 2. 登录后使用 | 注册门控生效，登录后功能正常 |

---

## 六、合并特有回归（P2）

| # | 测试场景 | 原因 |
|---|---------|------|
| 6.1 | `java-skills.ts` 是否包含 `filterExtensionSkillsByDisabledIds` | ⚠️ 不存在 — low-version 代码不含此函数（hebing 专有，合并时未引入） |
| 6.2 | `agent.ts` 是否包含 `disabledExtendedSkillIds` 传递 | ⚠️ 不存在 — low-version 代码不含此参数（同上原因） |
| 6.3 | `schema.sql` / `schema-mysql.sql` / `schema-h2.sql` 表结构一致 | ✅ mysql: X 表, h2: X 表（表数一致） |
| 6.4 | `application.properties.example` 存在 | ✅ EXISTS |
| 6.5 | `AGENTS.md` 存在 | ✅ EXISTS |
| 6.6 | `docker/` 目录存在 | ⚠️ N/A — `docker/` 仅在 `main` 分支，未进入 `hebing` 分支

---

## 七、执行顺序建议

```
Phase 1: 构建验证（1.1 → 1.2 → 1.3）
         ↓
Phase 2: 现有单元测试（2.1 ~ 2.12）
         ↓
Phase 3: 启动 3 个服务
         ↓
Phase 4: low-version 核心回归（3.1 ~ 3.3）
         ↓
Phase 5: hebing 新功能验证（4.1 ~ 4.5）
         ↓
Phase 6: 集成测试（5.1 ~ 5.6）
         ↓
Phase 7: 合并特有回归（6.1 ~ 6.6）
```

## 八、状态追踪

| 阶段 | 结果 | 备注 |
|------|------|------|
| Phase 1 - 构建 | ⚠️ 部分通过 | agent-core ✅ / gateway ✅ / frontend ❌（2 TS 错误） |
| Phase 2 - 单元测试 | ⚠️ 部分通过 | frontend 全过 ✅ / agent-core 仅 2.4 过 ✅ 其余缺依赖 ❌ / gateway 未跑 |
| Phase 3 - 服务启动 | ⬜ 待测 | 需启动 MySQL + 3 个服务 |
| Phase 4 - 核心回归 | ⬜ 待测 | 需运行中服务 |
| Phase 5 - 新功能 | ⬜ 待测 | 需运行中服务 |
| Phase 6 - 集成测试 | ⬜ 待测 | 需运行中服务 |
| Phase 7 - 回归检查 | ✅ 完成 | 6.4/6.5 存在，6.1/6.2 确认非必要，6.6 N/A |

---

## 九、发现的问题与修复建议

### Frontend 构建错误（2 个 TS 错误需手动修复）

**错误 1 — `MessageInput.vue:97`**：`sendMessage(text, currentUser.value?.id, files)` 传了 3 个参数

| 项目 | 说明 |
|------|------|
| 原因 | hebing 的 `MessageInput.vue` 调用签名是 `sendMessage(content, userId, files)`（3 参数），但 low-version 的 `useChat.ts` 中 `sendMessage` 只接受 2 个参数 `(content, userId)` |
| 修复 | 需要在 `useChat.ts` 的 `sendMessage` 签名中增加第 3 个 `files` 参数，或调整 `MessageInput.vue` 的调用方式 |

**错误 2 — `MessageList.vue:492`**：`Property 'sessionId' does not exist on type 'Message'`

| 项目 | 说明 |
|------|------|
| 原因 | hebing 的 `MessageList.vue` 引用了 `message.sessionId`，但 low-version 的 Message 类型没有此字段 |
| 修复 | 需在 Message 类型中补充 `sessionId` 可选字段，或调整 `MessageList.vue` 使用其他方式传递 sessionId |

### agent-core 测试失败（缺依赖）

| 问题 | 原因 | 修复 |
|------|------|------|
| 5/6 agent-core 测试因 MODULE_NOT_FOUND 失败 | 合并后未执行 `npm install`，缺少 `pinyin-pro` 等新增依赖 | 运行 `cd backend/agent-core && npm install` 后重新测试 |

### 未引入的 hebing 功能（预期行为）

| 功能 | 说明 |
|------|------|
| `filterExtensionSkillsByDisabledIds` | hebing 的 Skill 可用性过滤，未合入 low-version 重构架构 |
| `disabledExtendedSkillIds` 参数 | 同上，如需此功能需后续手动移植 |
| `docker/` 目录 | 存在于 `main` 但不在 `hebing`（lijianlong 的 low-version），不影响当前合并 |

