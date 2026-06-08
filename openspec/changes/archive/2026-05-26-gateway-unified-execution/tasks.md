## 1. Gateway — 核心执行服务

- [x] 1.1 新建 `SkillExecutionService.java`
  - 实现 HTTP 请求组装：URL query 拼接、Header 合并、Body 构造、parameterBinding（query/jsonBody/formBody）路由
  - 实现参数默认值合并：从 `parameterContract.properties.*.default` 读取 + 调用方参数覆盖
  - 实现执行分派：`kind=api` → HTTP 代理 / `kind=ssh` → SSH 执行 / `kind=template` → 返回 prompt
  - SSH 执行前通过 `SecurityFilterService.isCommandSafe()` 安全检查
  - 统一错误处理和结构化错误返回

- [ ] 1.2 新建 `PendingConfirmationStore.java`
  - 使用 `ConcurrentHashMap<String, PendingConfirmation>` 存储确认状态
  - `PendingConfirmation` 包含：skillId、parameters、userId、expiresAt
  - 实现 `put(requestId, confirmation)` / `remove(requestId)` / `getIfValid(requestId)`
  - `getIfValid` 校验：存在 + 未过期 + userId 匹配
  - 定时任务 `@Scheduled(fixedRate = 60000)` 清理过期记录

- [x] 1.3 新建 `POST /api/skills/execute` 端点
  - 在 `SkillController.java` 中新增方法
  - 请求格式：`{ skillId, parameters, confirmed?, requestId?, adjustedParams? }`
  - 调用 `SkillExecutionService.execute()`
  - 响应格式：成功时返回执行结果；需确认时返回 `{ status: "CONFIRMATION_REQUIRED", requestId, ... }`

## 2. Gateway — 确认门集成

- [x] 2.1 在 `SkillExecutionService.execute()` 中集成确认门
  - 执行前读 Skill 的 `requiresConfirmation` 字段
  - `requiresConfirmation=true` 且未带 `confirmed` → 生成 requestId → 存入 `PendingConfirmationStore` → 返回 CONFIRMATION_REQUIRED
  - `requiresConfirmation=false` → 直接进入执行分派
  - `confirmed=true` + 有效 requestId → 校验通过 → 应用 adjustedParams → 执行

- [x] 2.2 确认后参数覆盖
  - 若 `adjustedParams` 非空 → 覆盖原 parameters 中的对应字段
  - 合并后参数覆盖默认值合并结果中的对应字段

## 3. Gateway — 旧端点转调包装

- [x] 3.1 `POST /api/skills/api` 转调（按 endpoint 匹配 Skill → execute，失败回退旧路径）
- [x] 3.2 `POST /api/skills/ssh` 转调（按 command 匹配 SSH Skill → execute，失败回退旧路径）
- [x] 3.3 `POST /api/skills/linux-script` 转调（底层共用 SSHExecutorService，已实质收敛）
- [x] 3.4 `POST /api/skills/compute` 转调（底层共用 BuiltinToolExecutionService，已实质收敛）
- [x] 3.5 `POST /api/system-skills/execute` 转调（底层共用 BuiltinToolExecutionService，已实质收敛）

## 4. 配置与安全

- [x] 4.1 在 `SecurityConfig.java` 中放通 `POST /api/skills/execute`（已有规则 `"/api/skills/**" → authenticated` 覆盖，无需改动）

- [x] 4.2 添加必要配置项（确认超时时间，`PendingConfirmationStore` 默认 300 秒，可通过构造函数注入）

## 5. 验证

- [x] 5.1 新端点 curl 验证：不带确认的 API Skill 直接执行，结果与旧端点一致（skillId=21 验证通过）
- [x] 5.2 新端点 curl 验证：带确认的 Skill 返回 CONFIRMATION_REQUIRED，二次调用执行成功（skillId=21 两步全部通过）
- [x] 5.3 旧端点 curl 验证：`/api/skills/ssh` 通过按 command 匹配转调 execute，行为与改前一致
- [x] 5.4 端到端验证：新端点调用 API Skill 成功返回业务数据
- [x] 5.5 参数默认值合并验证：不传 type 默认用 "top" 返回头条，传 type=tiyu 返回体育（skillId=21 验证通过）
- [x] 5.6 parameterBinding 三种模式独立验证：query / jsonBody / formBody（skillId=21 全部通过，含 GET+jsonBody 回退 query）
- [x] 5.7 SSH 危险命令拦截验证（`shutdown now` 被正确拦截，返回 `Command blocked by security policy`）
- [ ] 5.8 确认过期清理验证：创建确认记录后等 6 分钟，确认带过期 requestId 被拒绝
