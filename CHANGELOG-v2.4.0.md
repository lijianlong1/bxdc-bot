# v2.4.0 版本更新记录

> 发布日期: 2026-05-14

---

## 一、API Skill 异步轮询支持

### 功能概述
支持长时间运行的 API 调用，通过 Gateway 托管的数据库持久化轮询机制处理分钟到小时级的异步任务。

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/AsyncTask.java` | 异步任务实体 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/AsyncTaskMapper.java` | 异步任务 Mapper |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingService.java` | 轮询业务服务 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/AsyncTaskPollingScheduler.java` | 定时轮询调度器 |
| `docs/deploy-ddl/001-async-task-polling.sql` | 异步任务表 DDL + 存量表加列 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/agent-core/src/tools/java-skills.ts` | 新增 `timeoutSeconds`、`asyncPoll` 配置字段；新增 `parameterBinding` 支持 formBody/query/jsonBody；SKILL GENERATOR 支持生成/编辑异步轮询 Skill |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/SkillController.java` | 新增 `POST /api/skills/api/async`、`GET /api/skills/async-tasks/{id}/wait`；新增文本提示词 CRUD 端点；异步任务初始提交含 `{id}` 占位校验 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/ApiProxyService.java` | `callApi` 新增 `timeoutSeconds` 参数支持 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/BuiltinToolExecutionService.java` | 异步 API 调用路径适配 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SecurityConfig.java` | 放通 `/api/skills/async-tasks/*/wait` 和 `/api/skills/text-prompts/**` |
| `backend/skill-gateway/src/main/resources/schema-mysql.sql` | 新增 `async_tasks` 表、`poll_retry_count` 列、`skill_text_prompts` 表 |
| `backend/skill-gateway/src/main/resources/application.properties` | 调优配置 |
| `backend/skill-gateway/pom.xml` | 依赖调整 |
| `backend/skill-gateway/src/main/java/.../SkillGatewayApplication.java` | 启用 `@EnableScheduling` |
| `backend/skill-gateway/src/main/java/.../audit/GatewayHttpClientAuditInterceptor.java` | 审计拦截器适配 |
| `frontend/src/components/SkillManagementModal.vue` | 新增异步轮询配置编辑区域；9 个文本框 AI 优化按钮集成；`asyncPollText` 绑定字段 |
| `frontend/src/utils/skillEditor.ts` | 新增 `asyncPollText` / `asyncPollEnabled` 草稿字段 |

### 数据库操作

```sql
-- 1. 新建 async_tasks 表（DDL 文件：docs/deploy-ddl/001-async-task-polling.sql）
CREATE TABLE IF NOT EXISTS async_tasks (...) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 存量表加列
ALTER TABLE async_tasks ADD COLUMN poll_retry_count INT DEFAULT 0 COMMENT 'consecutive poll failure count';

-- 3. 新建 skill_text_prompts 表（DDL 文件：docs/deploy-ddl/002-skill-text-prompts.sql）
CREATE TABLE IF NOT EXISTS skill_text_prompts (...) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 插入种子数据（DDL 文件：docs/deploy-ddl/003-skill-text-prompts-seed.sql）
INSERT INTO skill_text_prompts (...) VALUES ...;  -- 9 条
```

### 核心设计

```
Agent Core ──POST /skills/api/async──► Gateway ──初始调用──► 外部 API
                                         │
                                         ├─ 提取 task_id (idJsonPath)
                                         ├─ 写入 async_tasks (PENDING)
                                         └─ 返回 asyncTaskId

Agent Core ──GET /async-tasks/{id}/wait──► Gateway ──轮询 DB
                                         │
AsyncTaskPollingScheduler ──定时扫描──► async_tasks (PENDING/POLLING)
                                         │
                                         ├─ 调用外部 pollEndpoint (替换 {id})
                                         ├─ evaluateCompletion / evaluateFailure
                                         └─ 更新 status (COMPLETED/FAILED/TIMEOUT)
```

- **超时配置**: `timeoutSeconds` (默认 30s, 1-3600)
- **异步配置**: `asyncPoll` 对象（pollEndpoint/idJsonPath/completionJsonPath/completionValue/maxWaitSeconds 等）
- **容错**: 连续轮询失败 ≥ 3 次自动标记 FAILED，防止错误任务无限重试

---

## 二、AI 文本智能优化

### 功能概述
在 Skill 编辑表单的长文本输入框中集成 AI 优化按钮，调用大模型对文本框内容进行智能优化和格式校验。支持自然语言润色、JSON 语法修正、Shell 命令安全审查等。

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/agent-core/src/features/optimize-text/optimize-text.controller.ts` | `POST /features/optimize-text` 端点 |
| `backend/agent-core/src/features/optimize-text/optimize-text.service.ts` | LLM 调用服务 + 内置 9 套提示词 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/entity/SkillTextPrompt.java` | 提示词实体 |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/mapper/SkillTextPromptMapper.java` | 提示词 Mapper |
| `frontend/src/components/TextOptimizeModal.vue` | AI 优化对比弹窗组件 |
| `docs/deploy-ddl/002-skill-text-prompts.sql` | 提示词表 DDL |
| `docs/deploy-ddl/003-skill-text-prompts-seed.sql` | 种子数据 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/agent-core/src/app.module.ts` | 注册 `OptimizeTextController` |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/controller/UserController.java` | 新增 `POST /api/user/{id}/optimize-text` 端点（代理→注入 LLM 配置→转发 Agent Core） |
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/service/UserService.java` | 新增 `proxyTextOptimize()` 方法 |
| `frontend/src/components/SkillManagementModal.vue` | 9 个文本框新增 "✨ AI 优化" 按钮 + 优化状态管理 |

### 支持的文本框 (field_id)

| field_id | 标签 | 优化类型 |
|----------|------|----------|
| `description` | 技能介绍 | 自然语言润色 + 补充描述 |
| `api_interface_description` | 接口说明 | 结构化参数描述 |
| `api_parameter_contract` | 参数格式契约 (JSON) | JSON Schema 语法修正 |
| `api_async_poll` | 异步轮询配置 (JSON) | JSON 语法修正 + 字段限定 |
| `api_headers` | Headers (JSON) | JSON 语法修正 |
| `api_query` | Query (JSON) | JSON 语法修正 |
| `api_body` | Body (JSON) | JSON 语法修正 |
| `ssh_command` | 执行命令 | Shell 语法+安全审查 |
| `openclaw_prompt` | 自主规划提示词 | Markdown 结构优化 |

### 调用链路（与 Agent 对话完全一致）

```
前端(Skill编辑页) → Gateway(18080) POST /api/user/{userId}/optimize-text
                     │ userLlmOverridesFromDb(u) → 注入用户 LLM 配置
                     │ 如用户无配置则不传，由 Agent Core 环境变量兜底
                     └→ Agent Core(3000) POST /features/optimize-text
                          │ pickMergedLlm(body) → 优先 body 传参，fallback 环境变量
                          └→ ChatOpenAI.invoke(prompt + text) → 返回优化结果
```

### 数据库操作

```sql
-- 1. 建表（DDL 文件：docs/deploy-ddl/002-skill-text-prompts.sql）
CREATE TABLE IF NOT EXISTS skill_text_prompts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    field_id VARCHAR(64) NOT NULL UNIQUE,
    field_label VARCHAR(128),
    system_prompt TEXT,
    user_prompt_template TEXT,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 种子数据（DDL 文件：docs/deploy-ddl/003-skill-text-prompts-seed.sql）
INSERT INTO skill_text_prompts (field_id, field_label, system_prompt, user_prompt_template)
VALUES (...) ...;  -- 9 条
```

---

## 三、formBody 参数绑定增强

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/agent-core/src/tools/java-skills.ts` | `formUrlEncodeFlatBodyObject`: 支持数组通过重复 key 编码（`type=A&type=B`） |

### 变更说明

- `collectMergedScalarFields` 和 `formUrlEncodeFlatBodyObject` 现支持数组类型参数
- 数组元素通过 `URLSearchParams.append()` 重复 key 编码（标准 `application/x-www-form-urlencoded` 行为）

---

## 四、SKILL GENERATOR 增强

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/agent-core/src/tools/java-skills.ts` | 新增 `timeoutSeconds` / `asyncPoll` / `parameterBinding` 到 schema 和生成逻辑；`asyncPoll` describe 限定合法字段和路径格式规则 |

### 变更说明

- LLM 生成/修改 API Skill 时可指定 `parameterBinding`（query/jsonBody/formBody）
- 支持生成异步轮询 Skill（含完整的 `asyncPoll` 配置）
- Zod preprocess 修正 LLM 传入的字符串类型参数（`timeoutSeconds: "30"` → `30`；`asyncPoll: "{...}"` → `{...}`）
- `asyncPoll` 的 schema describe 明确禁止 `$` 前缀 JSON Path、含 `{id}` 占位要求、10 个合法字段白名单

---

## 五、Gateway 安全配置更新

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/skill-gateway/src/main/java/com/lobsterai/skillgateway/config/SecurityConfig.java` | 放通 `GET /api/skills/async-tasks/*/wait`、`GET /api/skills/text-prompts/**` |

---

## 六、部署说明

### 部署顺序

```bash
# 1. 执行数据库变更
mysql -u root -p fishtank < docs/deploy-ddl/001-async-task-polling.sql
mysql -u root -p fishtank < docs/deploy-ddl/002-skill-text-prompts.sql
mysql -u root -p fishtank < docs/deploy-ddl/003-skill-text-prompts-seed.sql

# 2. 重启 Gateway (port 18080)
cd backend/skill-gateway && mvn clean package && java -jar target/*.jar

# 3. 重启 Agent Core (port 3000)
cd backend/agent-core && npm run build && node dist/main.js

# 4. 前端 (Vite dev 或 build)
cd frontend && npm run build
```

### DDL 文件清单

| 文件 | 内容 |
|------|------|
| `docs/deploy-ddl/001-async-task-polling.sql` | `async_tasks` 建表 + `poll_retry_count` 加列 |
| `docs/deploy-ddl/002-skill-text-prompts.sql` | `skill_text_prompts` 建表 |
| `docs/deploy-ddl/003-skill-text-prompts-seed.sql` | 9 条种子数据 |

### 完全新增文件（本次首次提交）

| 文件 |
|------|
| `backend/skill-gateway/src/main/java/.../entity/AsyncTask.java` |
| `backend/skill-gateway/src/main/java/.../entity/SkillTextPrompt.java` |
| `backend/skill-gateway/src/main/java/.../mapper/AsyncTaskMapper.java` |
| `backend/skill-gateway/src/main/java/.../mapper/SkillTextPromptMapper.java` |
| `backend/skill-gateway/src/main/java/.../service/AsyncTaskPollingService.java` |
| `backend/skill-gateway/src/main/java/.../service/AsyncTaskPollingScheduler.java` |
| `backend/agent-core/src/features/optimize-text/optimize-text.controller.ts` |
| `backend/agent-core/src/features/optimize-text/optimize-text.service.ts` |
| `frontend/src/components/TextOptimizeModal.vue` |
| `docs/deploy-ddl/001-async-task-polling.sql` |
| `docs/deploy-ddl/002-skill-text-prompts.sql` |
| `docs/deploy-ddl/003-skill-text-prompts-seed.sql` |
| `docs/api-skill-upstream-requirements.md` |
| `openspec/changes/ai-text-optimize/` (完整 spec) |
| `openspec/changes/archive/2026-05-14-api-skill-long-running-support/` (完整 spec) |
