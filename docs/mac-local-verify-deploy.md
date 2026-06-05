# Fishtank Mac 本地验证部署文档

本文基于 `docs/single-host-deploy.md` 改写，目标不是生产上线，而是在一台 macOS 开发机上把三端跑起来，用于验证项目整体链路是否可用。

本文覆盖的三端如下：

- `frontend`：Vue 3 前端
- `skill-gateway`：Spring Boot 网关
- `agent-core`：NestJS Agent 服务

本地验证推荐直接使用 `localhost` 和开发模式启动，不依赖 `systemd`。如需模拟接近生产的访问方式，可选安装 `nginx` 做本地反向代理。

## 1. 本地验证拓扑

推荐的本地拓扑如下：

```text
浏览器
  -> http://127.0.0.1:5173      (frontend dev)
  -> http://127.0.0.1:18080     (skill-gateway)
  -> http://127.0.0.1:3000      (agent-core)

frontend -> skill-gateway
frontend -> agent-core
skill-gateway -> agent-core
agent-core -> mem0 / 大模型接口
```

推荐端口：

| 服务 | 地址 | 端口 | 说明 |
|------|------|------|------|
| `frontend` | `127.0.0.1` | `5173` | Vite 开发服务器 |
| `skill-gateway` | `127.0.0.1` | `18080` | 网关服务 |
| `agent-core` | `127.0.0.1` | `3000` | Agent 服务 |
| `mem0` | `127.0.0.1` 或远端 | `8001` | 可选依赖 |

## 2. 环境准备

建议本机安装以下运行时：

- `Node.js 18+`
- `npm`
- `Java 17`
- `Maven 3.8+`
- 可选：`nginx`

如果使用 Homebrew，可参考：

```bash
brew install node
brew install openjdk@17
brew install maven
brew install nginx
```

安装后建议确认版本：

```bash
node -v
npm -v
java -version
mvn -v
```

如果 `java -version` 不是 17，需要先切到 Java 17 再继续。

## 3. 目录说明

本地验证直接使用仓库源码目录即可，不需要像 Linux 服务器那样复制到 `/opt/fishtank`。

假设项目目录为：

```text
/Users/yourname/work/fishtank
```

本文以下命令都默认从该仓库根目录执行。

## 4. 本地配置修改

### 4.1 Frontend 配置

前端本地验证建议新建：

- `frontend/.env.local`

内容如下：

```env
VITE_API_URL=http://127.0.0.1:18080
VITE_AGENT_URL=http://127.0.0.1:3000
```

说明：

- `VITE_API_URL`：聊天任务、登录注册等接口走这里
- `VITE_AGENT_URL`：欢迎语、头像生成等接口直接访问 `agent-core`

### 4.2 Agent Core 配置

建议复制：

- `backend/agent-core/.env.example` -> `backend/agent-core/.env`

本地验证可先使用以下内容：

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

OPENAI_API_KEY=your-openai-compatible-key
OPENAI_MODEL_NAME=gpt-4o-mini
OPENAI_API_BASE=https://api.openai.com/v1

JAVA_GATEWAY_URL=http://127.0.0.1:18080
JAVA_GATEWAY_TOKEN=your-secure-token-here

MEM0_URL=http://127.0.0.1:8001
```

说明：

- `OPENAI_API_KEY` 必填，否则很多 Agent 能力不可用
- `JAVA_GATEWAY_URL` 必须指向本地网关
- `JAVA_GATEWAY_TOKEN` 必须与 `skill-gateway` 一致
- 如果本机没有部署 `mem0`，可以临时改成远端可用地址
- 当前代码在未配置 `MEM0_URL` 时，会回退到默认地址 `http://39.104.81.41:8001`
- 联调大模型 HTTP 时可将 `LLM_RAW_HTTP_LOG` 设为 `true`（或 `1` / `yes` / `on`），原始请求与响应会写入 `backend/agent-core/logs/llmOrg.log`（单个 JSON 数组、格式化；每次返回后插入 `----------------调用/返回----------------` 分割行，约保留最近 10 次往返）；**日志可能含密钥与用户内容**，默认关闭，勿在生产长期开启
- 若需将同等审计数据写入数据库便于集中管理：在已配置 `JAVA_GATEWAY_URL` 与 `JAVA_GATEWAY_TOKEN` 的前提下将 `LLM_ORG_LOG_REMOTE` 设为 `true`。agent-core 仅向 skill-gateway `POST /api/internal/llm-http-audit/events`，由网关写入表 `llm_http_audit_logs`（含 `user_id`、`recorded_at` 等）；**agent-core 不直连业务库**。可与本地 `llmOrg.log` 同时开启或单独开启远程；**仍可能含敏感内容**，生产慎用
- 调试前端入参时可将 `AGENT_RUN_RAW_LOG` 设为 `true`，每次 `POST /agent/run` 的请求体会脱敏后追加到 `logs/agentRun.log`（可用 `AGENT_RUN_RAW_LOG_MAX_CHARS`、`AGENT_RUN_RAW_LOG_PATH` 调整）；**仍可能含用户对话原文**，默认关闭

### 4.3 Skill Gateway 配置

建议新增本地配置文件：

- `backend/skill-gateway/src/main/resources/application-local.properties`

建议内容如下（与仓库默认 `application.properties` 一致时可省略本文件；需先在本机 MySQL 中创建库 `fishtank`，字符集建议 `utf8mb4`）：

```properties
spring.datasource.url=jdbc:mysql://127.0.0.1:3306/fishtank?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=UTC
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.username=root
spring.datasource.password=your-mysql-password
spring.sql.init.mode=always
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.defer-datasource-initialization=true

server.address=127.0.0.1
server.port=18080

agent.core.url=http://127.0.0.1:3000
app.cors.allowed-origins=http://127.0.0.1:5173,http://localhost:5173
```

另外在启动 `skill-gateway` 前，需要给进程注入：

```bash
export JAVA_GATEWAY_TOKEN=your-secure-token-here
```

说明：

- `agent.core.url` 必须指向本地 `agent-core`
- `app.cors.allowed-origins` 需要放通 Vite 本地地址
- 业务数据在 MySQL 库 `fishtank` 中；若曾使用旧版 H2 文件库，可将 H2 数据导出后再导入 MySQL（或在新库上从零开始）

## 5. 依赖安装

### 5.1 安装 Frontend 依赖

```bash
cd frontend
npm ci
```

### 5.2 安装 Agent Core 依赖

```bash
cd backend/agent-core
npm ci
```

### 5.3 准备 Skill Gateway

`skill-gateway` 是 Maven 项目，不需要 `npm install`。首次启动前可先验证依赖是否能正常解析：

```bash
cd backend/skill-gateway
mvn -DskipTests compile
```

## 6. 启动方式

本地验证建议开 3 个终端窗口。

### 6.1 启动 Agent Core

终端 1：

```bash
cd backend/agent-core
npm run start:dev
```

如果你只想验证接近生产的启动方式，也可以先构建再启动：

```bash
cd backend/agent-core
npm run build
node dist/main.js
```

### 6.2 启动 Skill Gateway

终端 2：

```bash
cd backend/skill-gateway
export JAVA_GATEWAY_TOKEN=your-secure-token-here
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

如果你想验证 jar 运行方式：

```bash
cd backend/skill-gateway
mvn -DskipTests package
export JAVA_GATEWAY_TOKEN=your-secure-token-here
java -jar target/skill-gateway-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

### 6.3 启动 Frontend

终端 3：

```bash
cd frontend
npm run dev
```

默认访问地址通常为：

```text
http://127.0.0.1:5173
```

## 7. 启动顺序

推荐按以下顺序启动：

1. 启动 `mem0`，或确认远端 `mem0` 地址可用
2. 启动 `agent-core`
3. 启动 `skill-gateway`
4. 启动 `frontend`
5. 浏览器访问前端页面验证链路

## 8. 本地联调验证

### 8.1 验证 Agent Core

```bash
curl http://127.0.0.1:3000/health
```

预期返回类似：

```json
{
  "status": "ok",
  "service": "agent-core"
}
```

### 8.2 验证 Skill Gateway

```bash
curl http://127.0.0.1:18080/api/health
```

公开接口也可验证：

```bash
curl http://127.0.0.1:18080/api/skills
```

### 8.3 验证 Frontend

浏览器访问：

```text
http://127.0.0.1:5173
```

重点检查：

- 页面是否能正常打开
- 注册、登录是否可用
- 聊天任务是否能创建成功
- SSE 是否能持续收到消息
- 欢迎语和头像生成功能是否正常

## 9. 可选：在 Mac 上模拟单域名访问

如果你希望本地访问方式更接近 `docs/single-host-deploy.md` 的生产结构，可以在 macOS 安装 `nginx` 后做本地代理。

### 9.1 先构建前端

```bash
cd frontend
npm run build
```

### 9.2 本地 nginx 示例

例如新增一个本地配置：

```nginx
server {
    listen 8080;
    server_name localhost;

    root /Users/yourname/work/fishtank/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /features/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

此时前端环境变量可改为：

```env
VITE_API_URL=http://127.0.0.1:8080
VITE_AGENT_URL=http://127.0.0.1:8080
```

这样浏览器就只访问一个入口，更接近生产部署方式。

## 10. 常见问题

### 10.1 前端启动正常，但页面请求报跨域

优先检查：

- `backend/skill-gateway/src/main/resources/application-local.properties` 中的 `app.cors.allowed-origins`
- 前端访问的是 `127.0.0.1:5173` 还是 `localhost:5173`
- `.env.local` 里的地址是否与实际启动地址一致

### 10.2 Frontend build 报 TypeScript 未使用变量错误

这类错误通常来自：

- 未使用的 `import`
- 路由守卫或函数参数声明了但没有使用

处理后重新执行：

```bash
cd frontend
npm run build
```

### 10.3 Skill Gateway 能启动，但 Agent 调技能接口返回 `401`

检查以下两边是否一致：

- `backend/agent-core/.env` 中的 `JAVA_GATEWAY_TOKEN`
- 启动 `skill-gateway` 时导出的 `JAVA_GATEWAY_TOKEN`

### 10.4 Agent Core 调不到大模型

优先检查：

- `OPENAI_API_KEY`
- `OPENAI_API_BASE`
- `OPENAI_MODEL_NAME`
- 当前网络是否可访问对应模型接口

### 10.5 Agent Core 调不到 mem0

优先检查：

- `MEM0_URL`
- 本机 `8001` 端口是否有服务
- 若使用远端地址，本机网络是否可访问

### 10.6 Skill Gateway 调不到 Agent Core

优先检查：

- `agent.core.url=http://127.0.0.1:3000`
- `curl http://127.0.0.1:3000/health`
- `agent-core` 是否已先启动

## 11. 验证通过后的结论判断

如果以下链路都能跑通，基本可以证明项目在 mac 本地环境具备可行性：

1. 前端页面能正常打开并登录
2. `skill-gateway` 能正常创建任务并返回 SSE
3. `agent-core` 能正常响应 `/health` 和功能接口
4. `agent-core` 能调用 `skill-gateway` 的受保护技能接口
5. 大模型和记忆服务依赖可正常连通

当本地验证通过后，再切换到 `docs/single-host-deploy.md` 中的 Linux 单机部署流程做正式环境上线，会更稳妥。
