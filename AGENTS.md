# AGENTS.md — bxdc-bot 项目 AI agent 工作规则

> 写给以后接手这个项目的 AI agent（或断点重启后的我自己）的工作约定。
> 补充项目本身不具备、但需要长期记住的上下文。

---

## 1. 部署规则 ⚠️ 最重要

**dist/ 已被 .gitignore 排除（commit c5d6ff3 之后）**。

- `frontend/dist/` 和 `backend/agent-core/dist/` **不进 git**
- `application.properties` **不进 git**（用 `.example` 模板 + 各人 cp）
- 部署/同事 clone 下来**自己 `npm run build` 生成 dist**

### 工作流

**本地开发（不需要 dist）：**
```bash
# 启动 3 个服务（都走源码，不走 dist）
cd backend/skill-gateway && ./apache-maven-3.9.6/bin/mvn spring-boot:run
cd backend/agent-core && npm run start:dev   # nest start --watch 走 ts-node
cd frontend && npm run dev                    # Vite 实时编译
```

**内网生产部署（自己 build dist）：**
```bash
# 1. 拉源码
git pull <origin-url> low-version

# 2. cp 配置模板
cp backend/skill-gateway/src/main/resources/application.properties.example \
   backend/skill-gateway/src/main/resources/application.properties
# 改 password= 为内网 MySQL 密码

# 3. 部署环境 build dist
# 部署环境已经预装好 node_modules/（基础镜像 / 容器复用），
# 所以不需要 npm install，直接 build 即可
cd frontend && npm run build
cd backend/agent-core && npm run build

# 4. 拿 dist/ + jar + config 部署到 nginx / jvm
```

### 提交源码时
- **只 commit 源码**（`frontend/src/`、`backend/agent-core/src/`、`backend/skill-gateway/src/main/java/`、OpenSpec、`.md`、`.gitignore` 等）
- **不 commit dist 产物**
- 跑 `git status` 确认没把 `dist/` 误带进来

---

## 2. 本地开发配置

### 数据库配置
- `backend/skill-gateway/src/main/resources/application.properties` **已 gitignore**
- 每个开发者自己 cp `.example` 模板 → 填入本机 MySQL 密码：
  ```bash
  cp backend/skill-gateway/src/main/resources/application.properties.example \
     backend/skill-gateway/src/main/resources/application.properties
  # 改 password= 为本机 MySQL root 密码
  ```
- MySQL 跑在 Docker 容器 `bxdc-mysql`（已开 8 天，端口 3306）

### 服务端口
- skill-gateway: 18080（Spring Boot）
- agent-core: 3000（NestJS）
- frontend: 5173（Vite dev）
- MySQL: 3306（Docker）

### 一键启动（3 个服务）
```bash
# 不同 terminal
cd backend/skill-gateway && ./apache-maven-3.9.6/bin/mvn spring-boot:run
cd backend/agent-core && npm run start:dev
cd frontend && npm run dev
```

---

## 3. OpenSpec 工作流

每次有"功能/改动/归档"需求，先建 change：
```bash
npx openspec new change <name>     # 创建
npx openspec archive <name> -y     # 归档（-y 跳过交互）
```

- 归档时如果报 `REMOVED failed for header "X" - not found`：原 spec 里没有这条 requirement，不能 REMOVE。删掉 `## REMOVED Requirements` 段，只保留 `## ADDED Requirements`。
- 归档产物落在 `openspec/changes/archive/YYYY-MM-DD-<name>/`。
- 主 spec 落地在 `openspec/specs/<capability>/spec.md`。

---

## 4. 异步任务系统（项目核心特性）

5 个原子 + 2 种模式：

| 原子 | 职责 |
|------|------|
| Submit | gateway 同步收一次 third-party，拿到 externalTaskId |
| Wait  | 客户端轮询 gateway 拿结果 |
| Audit | 写 `async_polling_audit_log` 记每步 phase |
| Dedup | SHA-256 签名 per-session 1h + no-session 60s 窗口去重 |
| Notify | 任务完成推前端通知中心（`/api/async-tasks/my`）|

**两种模式都走 fire-and-forget 立即返回**（不再阻塞 LLM）：
- `SINGLE_CALL`（单次长调用）：agent-core 提交完立即返回 `status: SINGLE_CALLED`
- `PERIODIC`（带 `pollEndpoint` 的轮询）：agent-core 提交完立即返回 `status: POLLING`

主 spec：`openspec/specs/api-extension-skill-llm-tool-call/spec.md`

---

## 5. 提交与分支约定

- **集成分支：`low-version`**（不是 main，所有改动先到这里）
- **远端：`myfork`** = `lijianlong1/bxdc-bot.git`（用 token 推送）
  - token 写在 git 命令里：`git push https://<token>@github.com/lijianlong1/bxdc-bot.git low-version`
- **Conventional Commits 风格**：
  - `feat(scope): 新功能`
  - `fix(scope): bug 修复`
  - `chore: 杂项`（配置、cleanup）
  - `docs: 文档`
  - `build: 构建产物`
  - `refactor: 重构`
  - 归档 OpenSpec change 用 `docs(openspec): ...`

---

## 6. 容易踩的坑

- **agent-core 残留进程**：`ps -ef | grep nest` 抓不到 `node` 启动的子进程，kill 时要按 PID 单独杀（grep 模式有 "node" 不一定匹配命令行）。
- **GitHub 推送限流**：经常 `Operation too slow` 或 `port 443 timeout`，sleep 30-50s 重试基本能过。
- **HEREDOC 在 zsh 里被破坏**：commit message 写 `/tmp/commit-msg.txt`，用 `git commit -F /tmp/commit-msg.txt`。
- **TypeScript `erasableSyntaxOnly: true` 禁用 enum**：用 union type + `as const satisfies Record<...>` 对象模式代替。
- **dist hash 变化**：Vite 会给主入口 css/js 换 hash，commit 时会删一堆旧 hash 文件 + 加新 hash 文件，正常。
- **应用 `192.168.65.1` client IP**：MySQL 看到的客户端 IP，Docker 桥接网络常见，可忽略。

---

## 7. 编程约束规范

团队代码规范，遵循这 3 条：

### 7.1 尽量不新增第三方包
- 新增第三方包意味着 supply chain 风险 + 依赖升级成本 + 团队学习成本
- 优先用 JDK 17 / NestJS 11 / Vue 3 / Spring Boot 2.7 自带的标准库
- 必须新增时需要评审：能不能用现有工具实现？有没有轻量级替代？

### 7.2 尽量不要新增环境变量配置
- 新的 env 变量意味着部署同事多配一项、新同事上手成本高
- 优先用代码内的合理默认值 + 配置文件覆盖
- 必须新增时需要用户明确要求，且要有默认值兜底

### 7.3 涉及数据库表操作可以使用 Java 代码做，尽量不增量运行 SQL 文件
- schema 变更优先用 Flyway / Liquibase 或 Spring Data JPA 自动 ddl，或者 `schema-mysql.sql` 一次性初始化（Spring `spring.sql.init.mode=always` 自动跑）
- **不要**在多个增量 commit 里改 `schema-mysql.sql` 让用户手动 `mysql -e "..."` 跑
- 复杂 schema 变更（加索引 / 改字段类型 / 数据迁移）走 Java migration 类（参考 `StartupRecoveryRunner` 模式）
