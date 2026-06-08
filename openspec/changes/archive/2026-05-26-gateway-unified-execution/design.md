## Context

当前 Skill Gateway 有 7 个执行端点，但底层只有 3 个执行服务（`BuiltinToolExecutionService` + `LinuxScriptExecutionService` + `ApiProxyService`）。Agent Core 的 `java-skills.ts`（~2800 行）承担了大量 HTTP 请求组装和执行分派逻辑。按照"Agent 只做推理编排，Gateway 做工具执行"的架构原则，需将执行逻辑下沉到 Gateway。

## Goals

- Gateway 建立统一的 `POST /api/skills/execute` 端点
- Gateway 侧完成 HTTP 请求组装（URL/query/headers/body + parameterBinding）
- 确认门逻辑从 Agent Core 移至 Gateway
- 旧端点内部转调新端点，底层收敛为唯一执行路径
- Agent Core 不做任何改动（Phase 2 再切换）

## Non-Goals

- 不修改 Agent Core 的调用方式
- 不处理异步轮询端点（`/api/skills/api/async`）的收敛（Phase 3）
- 不修改前端

## Decisions

### 1. 执行端点请求格式

**选择**：统一使用 `{ skillId, parameters, confirmed?, requestId? }` 格式。

**理由**：
- `skillId` 是数据库中 Skill 的主键，Gateway 可据此读取完整配置
- `parameters` 是调用方传入的完整参数对象（Agent 侧已合并默认值）
- `confirmed` + `requestId` 仅在确认流使用，与普通执行共用同一个端点

### 2. HTTP 请求组装放入独立 Service

**选择**：新建 `SkillExecutionService` 类，包含 HTTP 组装、kind 分派、确认门三个核心职责。

**理由**：
- 与 CRUD 逻辑（`SkillService`）分离，职责清晰
- 后续 Phase 2/3 改动集中在一个类中

### 3. 参数默认值合并位置

**选择**：在 Gateway 侧完成（而非依赖 Agent 传入完整参数）。

**理由**：
- Phase 1 内 Agent 不改，传入的参数可能不含默认值（如旧端点 `POST /api/skills/api` 的调用方式）
- Gateway 自己读 `parameterContract.properties.*.default` 合并，确保参数完整性
- Phase 2 后 Agent 也会做默认值合并，但 Gateway 侧作为兜底保留

合并规则：`merged = { ...defaults, ...callingParams }`（调用方传入值覆盖默认值）。

### 4. 确认门使用内存存储

**选择**：使用 `ConcurrentHashMap<String, PendingConfirmation>` 存储确认状态，定时任务每 60 秒清理过期记录。

**理由**：
- 当前单机部署，无需分布式存储
- 确认超时 5 分钟，过期自动清理
- 与当前 Agent Core 的做法一致（Agent Core 用的也是内存 Map）

### 5. 旧端点兼容方式

**选择**：旧端点方法内部解析请求参数，构造 `skillId` + `parameters`，转调 `SkillExecutionService.execute()`。不对 Agent Core 暴露 `/execute` 端点。

**理由**：
- Agent Core Phase 1 不改动，继续调旧端点
- Gateway 侧底层收敛为单一执行路径，为后续下线旧端点做准备
- 旧端点响应格式保持不变，对调用方透明

转调映射表：

| 旧端点 | skillId 来源 | parameters 来源 |
|--------|-------------|-----------------|
| `/api/skills/api` | 根据请求体中隐含信息查 `skills` 表 | 请求体 |
| `/api/skills/ssh` | 同上 | 请求体 |
| `/api/skills/linux-script` | 同上，`kind=ssh` | 请求体（含 `name` 或 `ip`） |
| `/api/skills/compute` | 查 `system_skills` 表 | 请求体 |
| `/api/system-skills/execute` | 解析 `toolName` 查 `system_skills` 表 | 请求体 `arguments` |

### 6. 执行分派策略

**选择**：在 `SkillExecutionService` 内部通过 `kind` 字段分派。

| kind | 执行路径 |
|------|---------|
| `api` | 拼 HTTP → `ApiProxyService.callApi()` |
| `ssh` | 台账解析（如有 userId）→ `SSHExecutorService.executeCommand()` |
| `template` | 直接返回 `configuration.prompt` |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 旧端点转调时 skillId 映射错误 | 根据 skill 名称 + 请求参数精确匹配；Phase 1 保留旧逻辑作为 fallback |
| HTTP 组装逻辑迁移后行为不一致 | 对照 Agent Core 现有 `executeConfiguredApiSkill` 逐项验证 |
| 确认门内存存储进程重启丢失 | 确认超时仅 5 分钟，重启后用户重试对话即可 |
| `/api/skills/api` 请求体不含 skillId，无法直接转调 | 通过 URL + method + userId 反查 `skills` 表定位对应 Skill |

## Migration Plan

1. 新建 `SkillExecutionService` 和 `PendingConfirmationStore`
2. 新增 `POST /api/skills/execute` 端点
3. 新增旧端点转调包装（每个旧端点方法内部调用 `SkillExecutionService.execute()`）
4. 单元测试 + curl 验证（新端点 + 旧端点兼容）
5. Agent Core **不做改动**

## Open Questions

- 旧端点 `POST /api/skills/api` 的请求体中不含 `skillId`，如何精确映射到 `skills` 表的记录？（当前方案：通过 endpoint URL 匹配，若匹配不到则回退到旧执行路径）
