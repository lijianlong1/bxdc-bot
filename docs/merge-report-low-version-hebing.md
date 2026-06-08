# 合并报告：low-version ← hebing

> 时间：2026-06-08  
> 合并提交：`963c484`

## 一、合并概览

| 项目 | 详情 |
|------|------|
| **源分支** | `hebing`（基于 `lijianlong/bxdc-bot` 的 `low-version`，HEAD: `e06f912`） |
| **目标分支** | `low-version`（本地重构分支，HEAD 原为 `fe33256`） |
| **共同祖先** | `02f23e1` - "fix: 轮询 pollHeaders 反序列化异常..." |
| **hebing 合入提交数** | 53 个 commits |
| **总变更** | 416 files, +89,101 / -17,170 lines |

## 二、合并内容分类

### 2.1 新增业务功能

| 分类 | 说明 | 关键文件 |
|------|------|---------|
| **文档解析** | Word/Excel/PPT 文本解析能力 | `WordParserService.java`, `ExcelParserService.java`, `PptParserService.java` + 对应 Controller/DTO/Exception |
| **文件上传** | 前端文件上传解析与发送 | `useFileUpload.ts`, `fileValidator.ts`, `docxParser.ts`, `xlsxParser.ts`, `pptParser.ts`, `txtParser.ts`, `gatewayDocParser.ts`, `vendorLoader.ts` |
| **异步通知中心** | 任务完成通知 + 历史记录 | `TaskNotificationBell.vue`, `useAsyncTaskNotifications.ts`, `AsyncTaskNotificationController.java` |
| **ThinkingMode** | 展示大模型思考过程 | `ThinkingMode.vue`, `useThinkingMode.ts` |
| **对话记录** | 下载 MD/PDF | `chatDownload.ts`, `ConversationLog.java`/`Service`/`Controller`, `ToolCallLog.java` |
| **mem0 用户画像** | 长期用户画像集成 | `mem/memory.service.ts` (agent-core) |
| **DeepSeek 兼容** | zod schema wrapper `ensureObjectType` | 多个 skill schema 文件 |
| **CORS 安全** | 来源白名单 | agent-core CORS 配置 |

### 2.2 工程化改进

| 改进 | 说明 |
|------|------|
| **dist/ 移除** | `b17c983` — dist 不再进 git，部署环境自行 `npm run build` |
| **配置模板化** | `d3d00fa` — `application.properties.example` 替代硬编码 |
| **Docker 部署** | `Dockerfile` + `nginx.conf` + `start.sh` |
| **AGENTS.md** | 项目 AI agent 工作规则 + 3 条编程约束规范 |
| **异步调用收口** | PERIODIC 也走"立即返回 + 通知中心"模式 |

## 三、冲突解决详情

### 3.1 dist/ modify/delete 冲突（6 个文件）

| 文件 | 解决方式 |
|------|---------|
| `agent-core/dist/src/agent/agent.js(.map)` | 接受 hebing 删除（dist 不进 git） |
| `agent-core/dist/src/tools/java-skills.*` | 接受 hebing 删除 |
| `agent-core/dist/tsconfig.tsbuildinfo` | 接受 hebing 删除 |
| `frontend/dist/assets/index-*.{css,js}` | 接受 hebing 删除 |
| `frontend/dist/index.html` | 接受 hebing 删除 |

### 3.2 源文件内容冲突（5 个文件）

| 文件 | 冲突区域 | low-version 改动 | hebing 改动 | **解决：以 low-version 为准** |
|------|---------|-----------------|------------|------|
| `java-skills.ts` | 4 处冲突（Schema 定义/AsyncPollConfig/schema wrapper/工具类） | 重构：删除旧工具类、提取共享模块 | 旧版 schema 定义、sshExecutorToolInputSchema、ensureObjectType | HEAD |
| `SkillController.java` | 2 处冲突（executeSkill 方法/linux-script 端点） | 统一执行入口 `SkillExecutionService.ExecuteRequest` | 旧版 async polling | HEAD |
| `AsyncTaskPollingScheduler.java` | 1 处冲突（executor/future 字段） | 新增 `pendingFutures` 机制 | 无此改动 | HEAD |
| `SkillManagementModal.vue` | 2 处冲突（import/表单渲染） | nextTick + ConfigFormRenderer | 无 nextTick + 旧版模板渲染 | HEAD |
| `useChat.ts` | 1 处冲突（SSE 处理器） | polling_status/complete/error 增强 | 移除了这些处理器 | HEAD |

## 四、low-version 核心文件保全验证

以下 low-version 重构文件 **完整保留**，未受合并影响：

| 文件 | 状态 |
|------|------|
| `agent-core/src/tools/skill-generator.ts` | OK |
| `agent-core/src/tools/openclaw-executor.ts` | OK |
| `agent-core/src/tools/manage-tasks.ts` | OK |
| `agent-core/src/tools/java-skills.ts` | OK（重构版） |
| `skill-gateway/.../SystemSkillController.java` | OK |
| `skill-gateway/.../SkillExecutionService.java` | OK |
| `skill-gateway/.../PendingConfirmationStore.java` | OK |
| `frontend/src/components/ConfigFormRenderer.vue` | OK |

## 五、未跟踪文件

合并后仍有以下文件未纳入版本控制（不受影响）：

| 文件 | 说明 |
|------|------|
| `backend/skill-gateway.zip` | 本地备份 |
| `backend/skill-gateway/m2-repository.tar.gz` | 本地 Maven 缓存 |
| `.trae/` | IDE 工具配置 |

## 六、后续建议

1. **重新构建 dist/**：合并后 dist 目录为空，需运行 `npm run build`
2. **验证编译**：
   - `cd backend/agent-core && npm run build`
   - `cd backend/skill-gateway && mvn compile`
   - `cd frontend && npm run build`
3. **测试验证**：运行现有测试确保无回归
4. **可选的额外合并**：hebing 分支的 `ensureObjectType`（DeepSeek 兼容）逻辑未合入，如需此功能需手动从 hebing 移植到当前重构架构中
