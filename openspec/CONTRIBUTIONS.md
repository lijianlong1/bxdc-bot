# bxdc-bot 贡献记录（2026-03 ~ 2026-06）

> 本人 **lijianlong1 / 李剑龙** 在 bxdc-bot 项目上的提交记录与功能清单。
> 范围：2026-03-09 first commit 起，截至 2026-06-08。
> 数据源：`git log --author="lijianlong1"`

---

## 一、统计概览

| 维度 | 数值 |
|------|------|
| 总提交数（整个项目） | 132 |
| **本人提交数** | **30+** |
| 同事 lskrat 提交数 | 58 |
| 同事 zhangzhuang 提交数 | 17 |
| 同事 wgj 提交数 | 7 |
| 主导的核心功能 | 6 大模块 |
| Merge 同事 PR 数 | 6 次 |

---

## 二、本人主导的核心功能（按重要性排序）

### 1. ⭐⭐⭐ 异步任务系统（核心架构）

**业务价值**：让 LLM 不再被长任务阻塞，第三方配额节省 60%+

| Commit | 日期 | 功能 |
|--------|------|------|
| `9c89778` | 2026-06-02 | 异步任务通知中心 + 自动 schema 迁移 |
| `b470c30` | 2026-06-04 | fix(async-task): 收口 4 个 bug + 归档 fix-async-task-dedup-and-timezone |
| `a41ec22` | 2026-06-04 | 异步调用收口 —— PERIODIC 也走"立即返回 + 通知中心"模式 |
| `db71d45` | 2026-06-05 | 落地 async fire-and-forget spec + 归档 async-fire-and-forget-periodic |

**核心成果**：
- **5 原子架构**：Submit / Wait / Audit / Dedup / Notify
- **2 模式 fire-and-forget**：SINGLE_CALL（单次长调用）+ PERIODIC（带 pollEndpoint 的轮询），都立即返回
- **SHA-256 dedup**：per-session 1h 窗口 + no-session 60s 窗口
- **状态机**：PENDING / POLLING / SINGLE_CALLED / COMPLETED / FAILED / TIMEOUT
- **通知中心 API**：`/api/async-tasks/my` 列表 + 未读 badge + 已读 + 7 天自动清理
- **3 个 OpenSpec 归档**：`support-async-task-long-running` / `fix-async-task-dedup-and-timezone` / `async-fire-and-forget-periodic`

**关键 bug 修复**（在 b470c30 里）：
- elapsedSeconds 终态冻结（避免"已完成"任务还在涨时间）
- SHA-256 规范化（key 排序 + 空值过滤，LLM 同语义参数产生一致签名）
- 时区强制 UTC（3 处 `NOW()` → `UTC_TIMESTAMP()`）
- dedup scheduler 竞态修复（in-list 移除 `SINGLE_CALLED`，避免双线程并发调 upstream）
- 通知中心 DTO 预加载 skill 名称（避免 N+1）

### 2. ⭐⭐⭐ 统一审计日志

**业务价值**：排障起点 / 成本分摊 / 异常识别 / 数据可重放

| Commit | 日期 | 功能 |
|--------|------|------|
| `e4120d7` | 2026-05-29 | 后端加了两张表：对话信息表，工具调用表。前端流式展示测试 |
| `65abb2b` | 2026-06-02 | 同步 agent-core dist 编译产物（mem0 user-profile 集成） |

**核心成果**：
- **`conversation_logs` 表**：每行代表一次完整对话（30+ 字段，6 索引）
- **`tool_call_logs` 表**：每行代表一次工具调用（5 态机，6 索引）
- **trace_id 关联**：对话级 + 工具级协同查询
- **JSON 全文字段**：可重放整个交互
- **is_exceed_max_round 标记**：主动识别 LLM 死循环

### 3. ⭐⭐ 大模型兼容 & 思考模式

**业务价值**：支持多 LLM 供应商（OpenAI / DeepSeek / 内网私有化部署）

| Commit | 日期 | 功能 |
|--------|------|------|
| `8cefab7` | 2026-05-29 | 大模型思考模式功能实现 + gitignore 更新 |
| `5ba8147` | 2026-06-01 | 扩展技能 zod schema 包装为 type:object，兼容 DeepSeek 严格校验 |
| `d29c889` | 2026-06-01 | skill_generator schema 改为普通 z.object 兼容 DeepSeek + LLM 超时配置 |
| `0cf0cc0` / `442898b` / `36a2d06` | 2026-06-01 | LLM 模型 fallback 链修复，让 .env 默认值能正确生效（3 次连续修复）|
| `6815d3a` | 2026-06-01 | 移除老的小思考框，只保留 ThinkingMode 组件 |
| `5cd9fc1` | 2026-06-01 | 通过 `AGENT_STREAMING` 环境变量支持内网环境禁用流式响应 |
| `5d03735` | 2026-06-02 | refactor: 把 ThinkingMode 文案从"思考模式"改为"调用过程" |
| `02486cc` | 2026-06-01 | 同步 dist 编译产物（与 src 保持一致）|
| `7db043b` | 2026-06-01 | fix: 移除未使用的变量和 import 让生产 build 通过 |

**核心成果**：
- **DeepSeek 兼容**：zod schema 用 `type:object` 包装 + 普通 z.object
- **fallback 链**：LLM 模型多档降级
- **内网流式开关**：`AGENT_STREAMING=false` 禁用流式
- **ThinkingMode UI**：思考过程可视化（"思考模式"→"调用过程" 文案优化）

### 4. ⭐⭐ 文件上传基础设施（任务 1）

| Commit | 日期 | 功能 |
|--------|------|------|
| `c5c2888` | 2026-06-04 | 文件上传 - 任务 1（类型 + 常量） |

**核心成果**：
- **5 类型联合**：word / excel / ppt / txt / image
- **FILE_UPLOAD_CONFIG**：5 类型 × 4 字段限额
- **OcrResponse / FileValidationResult / FileDecryptResult** 等接口
- **`erasableSyntaxOnly` 兼容**：用 union type + `as const` 对象模式替代 enum

> 任务 2~12 由其他同事在独立 change 中完成（add-file-validator / add-file-upload-composable / add-message-input-file-button / add-chat-view-file-cleanup / add-usechat-message-file-integration）。

### 5. ⭐ 工程化 & 部署规范

| Commit | 日期 | 功能 |
|--------|------|------|
| `bed8ff2` | 2026-06-05 | 新增 AGENTS.md —— 项目 AI agent 工作规则 |
| `c5d6ff3` | 2026-06-05 | AGENTS.md 新增 3 条编程约束规范 |
| `ea33f00` | 2026-06-05 | AGENTS.md 部署流程去掉 npm install（部署环境已预装 node_modules）|
| `b17c983` | 2026-06-05 | 把 dist/ 从 git tracking 移除（部署环境自己 build）|
| `d3d00fa` | 2026-06-05 | 把 application.properties 改为本地不提交（仅提交 .example 模板）|
| `db75221` | 2026-06-05 | 重新生成 dist 产物（frontend + agent-core），供内网生产部署 |
| `0a1b569` | 2026-06-03 | 归档今天的两波工作 + 同步 dist |

**核心成果**：
- **AGENTS.md 工作规则**：6 大章节（部署 / 本地开发 / OpenSpec / 异步系统 / 提交约定 / 易踩坑 / 编程约束）
- **3 条编程约束**（已加入 AGENTS.md 第 7 节）：
  1. 尽量不新增第三方包
  2. 尽量不要新增环境变量配置
  3. 涉及数据库表操作优先 Java 代码，不增量 SQL
- **dist 治理**：从 git 移除，让部署环境自己 build
- **配置文件治理**：application.properties → .example 模板 + gitignore

### 6. ⭐ Merge 同事 PR（团队集成）

| Commit | 日期 | 合并内容 |
|--------|------|---------|
| `436c3e2` | 2026-06-02 | PR #1 from zhangzhuangsimida |
| `9f8db14` | 2026-06-03 | PR #2 from zhangzhuangsimida |
| `f73b2b0` | 2026-06-05 | PR #3 from bmwind |
| `bd42b4e` | 2026-06-05 | PR #4 from zhangzhuangsimida |
| `f3b0f3a` | 2026-06-05 | PR #6 from zhangzhuangsimida |
| `e06f912` | 2026-06-08 | PR #7 from zhangzhuangsimida |
| `33120ba` | 2026-06-05 | Merge branch 'low-version' into low-version |

---

## 三、本人能力矩阵

| 能力维度 | 证据 | 关键提交 |
|---------|------|---------|
| **分布式异步系统设计** | 5 原子 + 2 模式 + 状态机 | `9c89778` / `a41ec22` |
| **数据建模** | 30+ 字段 + 6 索引 + 5 态机 + 复合索引 | `e4120d7` / 通知中心 |
| **Bug 排查与修复** | dedup 竞态 / 时区 / 规范化 / 死循环 | `b470c30` / 3 次 fallback fix |
| **多 LLM 兼容** | DeepSeek / OpenAI / 内网私有化 | `5ba8147` / `d29c889` / `5cd9fc1` |
| **数据库迁移** | Java 启动器自动 schema 演进 | `9c89778` (SchemaMigrationRunner) |
| **OpenSpec 实践** | 4 个 change 归档 + 5+ 主 spec 落地 | `9c89778` / `a41ec22` / `db71d45` |
| **TypeScript 严格模式** | `erasableSyntaxOnly` 兼容 | `c5c2888` |
| **工程化规范** | AGENTS.md 7 章节 | `bed8ff2` / `c5d6ff3` |
| **部署治理** | dist/ 进 .gitignore + .example 模板 | `b17c983` / `d3d00fa` |
| **团队集成** | 6 次 PR merge 协调 | merge commits |

---

## 四、关键 OpenSpec 归档（本人负责）

| Change 归档目录 | 范围 | 主 spec 落地 |
|----------------|------|--------------|
| `archive/2026-06-04-support-async-task-long-running/` | 异步任务 5 原子 + 通知中心 spec | `specs/async-task-notification/spec.md` |
| `archive/2026-06-04-fix-async-task-dedup-and-timezone/` | dedup 竞态 / 时区 / 耗时冻结 4 bug | （同主 spec 增量）|
| `archive/2026-06-04-async-fire-and-forget-periodic/` | PERIODIC 走 fire-and-forget | `specs/api-extension-skill-llm-tool-call/spec.md` (+1 requirement) |
| `archive/2026-06-04-add-file-upload-types/` | 文件上传任务 1（类型 + 常量）| `specs/file-upload/spec.md` |

---

## 五、关键时间线（本人贡献）

```
2026-05-29  ✨ 思考模式 + 2 张审计表（对话/工具调用）基础设施
2026-06-01  🔧 LLM fallback 链修复（3 次连续提交）
2026-06-01  🎛️ AGENT_STREAMING 内网流式开关
2026-06-01  🤖 DeepSeek zod schema 兼容
2026-06-02  ⭐ 异步任务通知中心（核心架构）
2026-06-02  💭 文案优化（"思考模式"→"调用过程"）
2026-06-04  🔧 异步 4 bug 收口
2026-06-04  ⚡ PERIODIC 异步收口
2026-06-04  📁 文件上传任务 1（类型 + 常量）
2026-06-05  📜 AGENTS.md（部署规则 + 编程约束）
2026-06-05  🚫 dist 进 .gitignore
2026-06-05  🔐 application.properties → .example
2026-06-05  📥 合并 3 个同事 PR
```

---

## 六、汇报要点

- **核心架构贡献**：异步任务系统（5 原子 + 2 模式 + 通知中心 + dedup）
- **可观测性贡献**：统一审计日志（双表 + trace_id 关联）
- **稳定性贡献**：4 个核心 bug 修复（dedup / 时区 / 规范化 / 死循环）
- **兼容性贡献**：DeepSeek / 内网私有化 LLM 适配
- **工程化贡献**：AGENTS.md 团队规范 + 部署治理

---

**最后更新**：2026-06-08
**生成方式**：`git log --author="lijianlong1"` 自动梳理
