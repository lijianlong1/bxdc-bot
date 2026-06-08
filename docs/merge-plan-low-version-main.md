# 合并方案：low-version ← main

## 一、背景

| 项目 | 说明 |
|------|------|
| **当前分支** | `low-version` (HEAD: `dc0302e`) |
| **被合入分支** | `main` (`b420753`) |
| **共同祖先** | `fb0e517` - "feat: 用户大模型设置、emoji 头像与 ChatOpenAI apiKey 修复" |
| **合并方向** | 将 `main` 合入 `low-version`（`git checkout low-version && git merge main`） |

## 二、两分支变更概览

### 2.1 low-version 独有提交（35 commits，自共同祖先以来）

**核心变更主题：Agent/SkillGateway 职责划分重构**（最近一次提交 `dc0302e`）：

| 模块 | 变更内容 |
|------|---------|
| `agent-core/src/tools/` | 从 `java-skills.ts` 提取 `skill-shared.ts` 共享模块；新增 `skill-generator.ts`（模板化 Skill 生成）、`openclaw-executor.ts`（SSH 执行器）；大幅精简 `java-skills.ts`（-2316 行） |
| `agent-core/src/agent/` | `agent.ts` 重构：引入 `MemorySaver` checkpoint、拆分 tool 导入路径、修改 tool 挂载逻辑 |
| `skill-gateway/controller/` | 新增 `SystemSkillController.java`（统一管理入口）、重构 `SkillController.java` |
| `skill-gateway/service/` | 新增 `SkillExecutionService.java`（统一执行流程）、`PendingConfirmationStore.java`（确认挂起）；修改 `ApiProxyService.java`、`AsyncTaskPollingScheduler.java`、`SkillService.java` |
| `skill-gateway/entity/` | 更新 `Skill.java` 实体 |
| `skill-gateway/schema/` | 更新 `schema.sql`、`schema-mysql.sql`、`schema-h2.sql` |
| `frontend/` | 新增 `ConfigFormRenderer.vue`；增强 `SkillManagementModal.vue`；更新 `skillEditor.ts`、`useChat.ts` |

其他 commit：异步轮询进度展示、pollHeaders 修复、health version 接口、Java 1.8 兼容、confirm flow 等。

### 2.2 main 独有提交（3 commits）

| Commit | 说明 |
|--------|------|
| `0520ff7` | **feat(agent-core): tool prompt compat mode and XML/JSON tool-call parsing** — 新增 `tool-prompt-compat.ts`（兼容模式）、`xml-tool-call-compat.ts`（XML/JSON 解析）；修改 `agent.ts`、`skill.manager.ts`、`java-skills.ts` 等 |
| `7efc817` | **docs: add internal stack refactor plan and API draft** — 纯文档，`doc/internal-stack-*.md/yaml` |
| `b420753` | **feat: skill availability, compat hints, agent filtering** — Skill 可用性开关（前后端）、渐进披露 compat hints、Docker 部署配置、User 服务/Settings 增强 |

## 三、冲突文件清单（双方均修改）

共 **15 个源文件** 存在合并冲突风险：

### 3.1 agent-core（6 个文件）

| 文件 | main 改动 | low-version 改动 | 冲突风险 |
|------|----------|-----------------|---------|
| `src/agent/agent.ts` | tool prompt compat 模式判断、postModelHook、disabledExtendedSkillIds | MemorySaver checkpoint、tool 导入路径重构、文件头注释、createReactAgent 参数调整 | **高** — 两方都重构了工厂方法签名和内部逻辑 |
| `src/controller/agent.controller.ts` | disabledExtendedSkillIds 传递 | SSE/polling 相关增强 | **中** |
| `src/skills/skill.manager.ts` | compat 模式注入、compatToolHint 解析、技能列表格式调整 | 渐进披露相关改动 | **中** — 格式和逻辑方向一致但实现细节不同 |
| `src/tools/java-skills.ts` | filterExtensionSkillsByDisabledIds、disabledExtendedSkillIds 过滤 | **大幅重构**：提取共享模块、新增导入（zod/pinyin）、删除 JavaSshTool/JavaLinuxScriptTool 等 | **极高** — low-version 重构幅度很大 |
| `src/utils/logger.service.ts` | compat 模式相关日志增强 | 轮询/SSE 相关日志增强 | **低** — 独立改动，可能可自动合并 |
| `test/logger.service.test.cjs` | compat 模式测试用例 | 轮询/SSE 测试用例 | **低** — 独立改动 |

### 3.2 skill-gateway（6 个文件）

| 文件 | main 改动 | low-version 改动 | 冲突风险 |
|------|----------|-----------------|---------|
| `config/SecurityConfig.java` | 放开 skill-availability 端点权限 | 放开统一执行端点权限 | **低** — 独立 URL pattern，可手动合并 |
| `controller/TaskController.java` | 用户 skill 过滤 | 轮询/polling status 增强 | **中** |
| `controller/UserController.java` | 新增 skill-availability GET/PUT、greeting POST | 注册门控/profile 等改动 | **低** — 新增方法不同，可手动合并 |
| `entity/User.java` | 新增 disabledExtensionSkillIds 字段 | user 相关字段调整 | **低** |
| `service/UserService.java` | 新增 getSkillAvailability/updateSkillAvailability/proxyAvatarGreeting | user 服务相关改动 | **中** — 新增方法不冲突 |
| `test/.../SkillControllerCrudTest.java` | 可用性过滤测试 | CRUD 相关测试调整 | **低** |

### 3.3 frontend（3 个文件）

| 文件 | main 改动 | low-version 改动 | 冲突风险 |
|------|----------|-----------------|---------|
| `src/composables/useChat.ts` | 技能过滤、disabled ids 传递 | 确认流程、polling_status、logTimeline、详细 console 日志 | **高** — 大量并行改动 |
| `src/composables/useSkillHub.ts` | availability toggle 状态管理 | skill hub 增强 | **中** |
| `src/composables/useUser.ts` | skill availability API 调用 | user 相关增强 | **中** |

## 四、安全文件（main 独有，不会冲突）

以下文件仅在 `main` 分支修改/新增，合并时 **可自动合入**，无需手动处理：

### 4.1 agent-core 新增

| 文件 | 说明 |
|------|------|
| `src/utils/tool-prompt-compat.ts` | **NEW** — 工具提示兼容模式 |
| `src/utils/xml-tool-call-compat.ts` | **NEW** — XML/JSON 工具调用解析 |
| `test/tool-prompt-compat.test.cjs` | **NEW** |
| `test/xml-tool-call-compat.test.cjs` | **NEW** |
| `test/skill-availability-filter.test.cjs` | **NEW** |
| `test/skill-manager-progressive-disclosure.test.cjs` | **NEW** |

### 4.2 skill-gateway 新增

| 文件 | 说明 |
|------|------|
| `dto/SkillAvailabilityResponse.java` | **NEW** |
| `dto/SkillAvailabilityUpdateRequest.java` | **NEW** |
| `dto/SkillOptionDto.java` | **NEW** |
| `test/.../UserSkillAvailabilityControllerTest.java` | **NEW** |

### 4.3 frontend 仅 main 修改

| 文件 | 说明 |
|------|------|
| `src/views/SettingsView.vue` | Skill availability 设置 UI |
| `src/services/config.ts` | API 端点配置 |
| `.env.example` / `.gitignore` | 构建配置 |

### 4.4 基础设施新增（main）

| 文件 | 说明 |
|------|------|
| `docker/Dockerfile` | **NEW** |
| `docker/nginx.conf` | **NEW** |
| `docker/start.sh` | **NEW** |
| `scripts/verify-gateway-browser-bff.sh` | **NEW** |
| `doc/internal-stack-refactor-dev-plan.md` | **NEW** — 内部重构计划 |
| `doc/internal-stack-api-draft.yaml` | **NEW** — API 草案 |

## 五、必须保留的 low-version 文件（合并优先级：low-version > main）

以下文件/目录是 `low-version` 分支 Agent/SkillGateway 职责划分重构的核心产物，**合并后必须保持 low-version 版本**（或在冲突解决中以 low-version 为准）：

### 5.1 绝对不可覆盖（NEW in low-version）

| 文件 | 原因 |
|------|------|
| `agent-core/src/tools/skill-shared.ts` | 共享模块，java-skills 重构基石 |
| `agent-core/src/tools/skill-generator.ts` | Skill 模板化生成器 |
| `agent-core/src/tools/openclaw-executor.ts` | OPENCLAW/SSH 执行器 |
| `skill-gateway/.../controller/SystemSkillController.java` | Gateway 统一管理入口 |
| `skill-gateway/.../service/SkillExecutionService.java` | Gateway 统一执行流程 |
| `skill-gateway/.../service/PendingConfirmationStore.java` | 确认挂起机制 |
| `frontend/src/components/ConfigFormRenderer.vue` | 动态表单渲染组件 |

### 5.2 冲突解决以 low-version 为准的文件

| 文件 | 处理原则 |
|------|---------|
| `agent-core/src/tools/java-skills.ts` | **以 low-version 为准**，但需手动补入 main 的 `filterExtensionSkillsByDisabledIds` 函数和 `disabledExtendedSkillIds` 参数 |
| `agent-core/src/agent/agent.ts` | **以 low-version 的重构版本为基础**，在此基础上融入 main 的 `disabledExtendedSkillIds`、`toolPromptCompat`、`postModelHook` 逻辑 |
| `skill-gateway/.../controller/SkillController.java` | **以 low-version 为准**，main 未改动此文件（main 改动在 SkillControllerCrudTest.java） |

## 六、推荐合并步骤

### Step 1：准备工作

```bash
git checkout low-version
git fetch origin  # 如果网络可用
git merge-base low-version main  # 确认共同祖先：fb0e517
```

### Step 2：执行合并

```bash
git merge main
```

预期产生冲突的文件约 **6-8 个**：`agent.ts`、`java-skills.ts`、`skill.manager.ts`、`useChat.ts`、`useSkillHub.ts`、`useUser.ts`、`agent.controller.ts`、`TaskController.java`。

### Step 3：解决冲突（按优先级）

#### 优先级 A — agent-core 核心重构文件

**`agent-core/src/tools/java-skills.ts`**：
1. 接受 low-version 版本作为 baseline
2. 手动补入 main 版本的 `filterExtensionSkillsByDisabledIds` 函数（约 12 行）
3. 在 `loadGatewayExtendedTools` 函数签名中保留 `disabledExtendedSkillIds?: string[]` 参数
4. 在过滤逻辑中调用 `filterExtensionSkillsByDisabledIds`

**`agent-core/src/agent/agent.ts`**：
1. 以 low-version 的重构版本为 baseline（保留 MemorySaver、tool 导入路径重构）
2. 融入 main 的 tool prompt compat 逻辑：`isAgentToolPromptCompatEnabled()`、`createXmlToolCallPostHook`
3. 融入 main 的 `disabledExtendedSkillIds` 配置项传递

**`agent-core/src/skills/skill.manager.ts`**：
1. 合并时需保留两边的实用函数（main 的 `compatToolHint`、low-version 的渐进披露逻辑）
2. `buildSkillListPrompt` 和 `buildLoadedSkillPrompt` 以 low-version 版本为 baseline，在此基础上考虑是否融入 main 的 compact hint 特性

#### 优先级 B — skill-gateway 服务层

**`backend/skill-gateway/.../controller/UserController.java`**：
- 两边新增的方法不重叠，手动合并时保留所有方法
- main 新增：`getSkillAvailability`、`putSkillAvailability`、`greeting`
- low-version 新增：注册门控相关

**`backend/skill-gateway/.../service/UserService.java`**：
- 手动合并，两边新增方法不冲突

#### 优先级 C — frontend 组合式函数

**`frontend/src/composables/useChat.ts`**：
- 两边改动量都很大，建议先接受 low-version 版本，然后手动补入 main 的 `disabledSkillIds` 传递链路
- main 的 `filterExtensionSkillsByDisabledIds` 调用点需要保留

**`frontend/src/composables/useSkillHub.ts`**：
- 手动合并两边的状态管理逻辑

**`frontend/src/composables/useUser.ts`**：
- 手动合并，main 新增的 skill availability API 调用需要保留

### Step 4：验证编译

```bash
# agent-core
cd backend/agent-core && npm run build

# skill-gateway
cd backend/skill-gateway && mvn compile -q

# frontend
cd frontend && npm run build
```

### Step 5：运行测试

```bash
cd backend/agent-core && npm test
cd backend/skill-gateway && mvn test
```

### Step 6：完成合并

```bash
git add -A
git commit -m "merge: 合并 main 分支的 skill availability/工具兼容模式/Docker 配置

合入 main 分支的以下功能：
- feat: skill availability toggle（前后端 Skill 启用/禁用开关）
- feat: tool prompt compat mode + XML/JSON tool-call 解析
- feat: Docker 部署配置
- feat: 用户 Settings 增强（greeting 代理等）
- docs: 内部重构计划文档

冲突解决原则：
- agent-core 核心重构（java-skills/skill-shared/skill-generator/openclaw-executor）以 low-version 为准
- skill-gateway 统一执行入口（SystemSkillController/SkillExecutionService）以 low-version 为准
- 冲突文件手工合并，保留 main 新增的 disabledExtendedSkillIds 过滤和 toolCompat 逻辑
"
```

## 七、合并后验证清单

| 检查项 | 验证方式 |
|--------|---------|
| `java-skills.ts` 是否包含 `filterExtensionSkillsByDisabledIds` | grep 搜索 |
| `agent.ts` 是否包含 `disabledExtendedSkillIds` 传递 | grep 搜索 |
| `SystemSkillController.java` 文件存在 | 文件存在性 |
| `SkillExecutionService.java` 文件存在 | 文件存在性 |
| `skill-generator.ts` / `openclaw-executor.ts` 文件存在 | 文件存在性 |
| `ConfigFormRenderer.vue` 文件存在 | 文件存在性 |
| `docker/` 目录存在 | 文件存在性 |
| `tool-prompt-compat.ts` / `xml-tool-call-compat.ts` 文件存在 | 文件存在性 |
| agent-core 编译通过 | `npm run build` |
| skill-gateway 编译通过 | `mvn compile` |
| frontend 编译通过 | `npm run build` |

## 八、风险提示

1. **`java-skills.ts` 合并风险最高**：low-version 删除了 `JavaSshTool`、`JavaLinuxScriptTool`，重构了导入路径（新增 `zod`、`pinyin`、`openclaw-executor` 等导入）。main 在此文件上改动较小（仅 `filterExtensionSkillsByDisabledIds`），建议以 low-version 为准再手动补入 main 改动。

2. **`agent.ts` 两方均大幅重构**：low-version 引入 `MemorySaver`、修改 tool 导入；main 引入 `postModelHook`、`toolPromptCompat`。建议以 low-version 为基础逐步融入 main 的逻辑。

3. **不要丢失 dist/ 文件**：合并后需重新构建 `agent-core/dist/` 以同步 `skill-shared.js`、`skill-generator.js`、`openclaw-executor.js` 等新文件。

4. **schema 文件不变**：`main` 的 `schema.sql` / `schema-mysql.sql` 未改动，以 `low-version` 版本为准。
