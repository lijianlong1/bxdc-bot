# Fishtank 三端单机部署文档

本文用于指导在同一台 Linux 服务器上部署以下三端，并说明上线前需要修改的配置项：

- `frontend`：Vue 3 前端静态站点
- `skill-gateway`：Spring Boot 网关服务
- `agent-core`：NestJS Agent 服务

推荐采用单域名反向代理方式，对外只暴露 `80/443`，内部服务仅监听本机地址。

## 1. 部署拓扑

推荐部署结构如下：

```text
浏览器
  -> nginx:80/443
     -> /            -> frontend/dist
     -> /api/        -> 127.0.0.1:18080   (skill-gateway)
     -> /features/   -> 127.0.0.1:3000    (agent-core)

skill-gateway -> agent-core
agent-core -> mem0 / 大模型接口
```

推荐端口规划：

| 服务 | 监听地址 | 端口 | 说明 |
|------|----------|------|------|
| `frontend` | 由 `nginx` 托管 | - | 静态文件，不单独监听业务端口 |
| `skill-gateway` | `127.0.0.1` | `18080` | 网关接口、鉴权、SSE 转发 |
| `agent-core` | `127.0.0.1` 或 `0.0.0.0` | `3000` | Agent 编排与功能接口 |
| `mem0` | `127.0.0.1` 或远端地址 | `8001` | 可选依赖，不属于三端主体 |

## 2. 服务器准备

建议服务器至少准备以下运行环境：

- `nginx`
- `Node.js 18+`
- `Java 17`
- `Maven 3.8+`，仅在服务器本地打包 `skill-gateway` 时需要
- `systemd`，用于托管后台服务

如果目标服务器不能联网，请在有网环境完成构建，再上传构建产物。

## 3. 推荐目录结构

建议统一部署到 `/opt/fishtank`：

```text
/opt/fishtank/
├── frontend/
│   └── dist/
├── agent-core/
│   ├── dist/
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   ├── SKILLs/
│   └── .env
├── skill-gateway/
│   ├── skill-gateway-0.0.1-SNAPSHOT.jar
│   └── application-prod.properties
└── data/
    └── (可选) 其他运行时文件；持久化关系数据使用 MySQL 时，库与表由数据库实例维护，不在此目录存放 `.mv.db` 文件
```

## 4. 三端上线前配置修改

### 4.1 Frontend 配置

文件来源：`frontend/.env.production.example`

生产环境建议新建 `frontend/.env.production`：

```env
VITE_API_URL=https://your-domain.example.com
VITE_AGENT_URL=https://your-domain.example.com
```

配置说明：

- `VITE_API_URL`：前端访问 `skill-gateway` 的基础地址
- `VITE_AGENT_URL`：前端访问 `agent-core` 的基础地址

当前代码中：

- 聊天任务、登录注册等走 `VITE_API_URL`
- 欢迎语、头像生成等接口直接走 `VITE_AGENT_URL`

如果采用同域名反向代理，这两个值都写成同一个域名即可，例如 `https://your-domain.example.com`。

**Emoji 头像（Twemoji）**：前端将 Twemoji 静态文件打包在 `frontend/public/twemoji/` 下，运行时从**同源路径**加载，**不需要**浏览器访问外网 CDN。若生产环境配置了 **Content-Security-Policy**，`img-src` 允许 `self` 与 `data:` 即可；无需为 `cdn.jsdelivr.net` 放行。若静态资源托管在单独域名，可设置 `VITE_TWEMOJI_ASSETS_BASE` 指向该资源根地址。

### 4.2 Agent Core 配置

文件来源：`backend/agent-core/.env.example`

生产环境建议复制为 `/opt/fishtank/agent-core/.env`：

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

OPENAI_API_KEY=your-openai-compatible-key
OPENAI_MODEL_NAME=gpt-4o-mini
OPENAI_API_BASE=https://api.openai.com/v1

JAVA_GATEWAY_URL=http://127.0.0.1:18080
JAVA_GATEWAY_TOKEN=your-secure-token-here

MEM0_URL=http://127.0.0.1:8001
```

配置说明：

- `HOST`：监听地址。若只通过 `nginx` 访问，建议仍可保留 `0.0.0.0` 或改为 `127.0.0.1`
- `PORT`：`agent-core` 监听端口，默认 `3000`
- `OPENAI_API_KEY`：大模型接口密钥
- `OPENAI_MODEL_NAME`：模型名
- `OPENAI_API_BASE`：兼容 OpenAI 协议的接口地址
- `JAVA_GATEWAY_URL`：指向 `skill-gateway` 内网地址
- `JAVA_GATEWAY_TOKEN`：调用 `skill-gateway` 的鉴权 token，必须与网关侧保持一致
- `MEM0_URL`：记忆服务地址，可为本机或远端

登录用户可在前端「大模型设置」中配置各自的 `OPENAI_API_BASE` / 模型名 / API Key（存于 `skill-gateway` 数据库，首版为明文字段）。`agent-core` 执行任务时会用用户已保存的非空项覆盖上述环境变量对应项；未配置的项仍使用 `.env` 中的默认值。头像「AI 推荐」等由网关代理到 `agent-core` 的请求也会在网关侧按「用户配置 + 本机环境变量」合并后再转发。为在未填写用户配置时仍可使用服务端默认 Key，可在 **`skill-gateway` 进程环境**中同样设置 `OPENAI_API_KEY`（以及可选的 `OPENAI_MODEL_NAME`、`OPENAI_API_BASE`），与 `agent-core` 保持一致即可。API Key 仅保存在服务端，请勿在浏览器控制台或前端状态中持久化明文。

### 4.3 Skill Gateway 配置

部署前在 MySQL 中创建业务库（示例：`CREATE DATABASE fishtank CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`），并授予应用账号相应权限。

文件来源：`backend/skill-gateway/src/main/resources/application-prod.example.properties`

生产环境建议放置为 `/opt/fishtank/skill-gateway/application-prod.properties`：

```properties
spring.datasource.url=jdbc:mysql://127.0.0.1:3306/fishtank?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=UTC
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.username=fishtank_app
spring.datasource.password=change-this-password
spring.sql.init.mode=always
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.defer-datasource-initialization=true

server.address=127.0.0.1
server.port=18080

agent.core.url=http://127.0.0.1:3000
app.cors.allowed-origins=https://your-domain.example.com
```

除此之外，`skill-gateway` 的技能执行接口还会读取环境变量：

```bash
export JAVA_GATEWAY_TOKEN=your-secure-token-here
```

配置说明：

- `spring.datasource.*`：MySQL 连接（主机、库名、账号、密码；生产请用强密码并由 `SPRING_DATASOURCE_*` 等环境变量注入，勿提交明文）
- `spring.jpa.defer-datasource-initialization=true`：**必须保留**。使用 `--spring.config.location` 指向单独 properties 文件时，会覆盖 JAR 内默认配置；若缺少此项，`schema.sql` 会在 Hibernate 建表之前执行，启动会报 `Table "SKILLS" not found`（见 11.7 节）
- `server.address`：建议改成 `127.0.0.1`，避免直接暴露网关端口
- `server.port`：网关监听端口，默认 `18080`
- `agent.core.url`：网关调用 `agent-core` 的地址
- `app.cors.allowed-origins`：允许浏览器访问的前端域名，多个域名可用英文逗号分隔
- `JAVA_GATEWAY_TOKEN`：`/api/skills/**` 写操作接口使用的鉴权 token

## 5. 三端打包步骤

### 5.1 打包 Frontend

在有网环境执行：

```bash
cd frontend
npm ci
npm run build
```

构建完成后生成：

- `frontend/dist/`

上传到服务器目标目录：

- `/opt/fishtank/frontend/dist`

### 5.2 打包 Agent Core

在有网环境执行：

```bash
cd backend/agent-core
npm ci
npm run build
```

需要上传的内容：

- `dist/`
- `node_modules/`
- `package.json`
- `package-lock.json`
- `SKILLs/`
- `.env`

如果希望打成一个离线包，可在 `backend` 目录执行：

```bash
tar czvf agent-core-deploy.tar.gz \
  agent-core/dist \
  agent-core/node_modules \
  agent-core/package.json \
  agent-core/package-lock.json \
  agent-core/SKILLs \
  agent-core/.env
```

注意事项：

- `node_modules` 与操作系统、CPU 架构相关
- 目标服务器是 Linux 时，最好在 Linux 环境执行 `npm ci`
- 不建议直接把 macOS 上安装出来的 `node_modules` 拷贝到 Linux 运行

### 5.3 打包 Skill Gateway

在有网环境执行：

```bash
cd backend/skill-gateway
mvn -DskipTests package
```

构建完成后生成：

- `target/skill-gateway-0.0.1-SNAPSHOT.jar`

上传以下内容到服务器：

- `target/skill-gateway-0.0.1-SNAPSHOT.jar`
- `application-prod.properties`

## 6. 服务器部署步骤

### 6.1 部署 Frontend

```bash
mkdir -p /opt/fishtank/frontend
```

将本地构建得到的 `dist/` 整体上传到：

- `/opt/fishtank/frontend/dist`

### 6.2 部署 Agent Core

```bash
mkdir -p /opt/fishtank/agent-core
```

将构建产物上传并解压到 `/opt/fishtank/agent-core`，确保该目录下至少包含：

- `dist/`
- `node_modules/`
- `package.json`
- `package-lock.json`
- `SKILLs/`
- `.env`

若使用第 5.2 节打好的离线包 `agent-core-deploy.tar.gz`（包内路径为 `agent-core/...`），**请在 `/opt/fishtank` 下解压**，使 `dist/main.js` 落在 systemd 期望的位置，避免多一层目录：

```bash
cd /opt/fishtank
tar xzvf agent-core/agent-core-deploy.tar.gz
```

若在 `/opt/fishtank/agent-core` 目录内直接解压，可能出现 `/opt/fishtank/agent-core/agent-core/dist/...`，与 `ExecStart` 中的路径不一致；此时应将内层 `agent-core` 下的内容移到 `/opt/fishtank/agent-core`，或删除外层后重新按上文在 `/opt/fishtank` 解压。

解压后自检：

```bash
test -f /opt/fishtank/agent-core/dist/main.js && echo "dist OK"
```

启动命令：

```bash
cd /opt/fishtank/agent-core
node dist/main.js
```

### 6.3 部署 Skill Gateway

`skill-gateway` 为单个可执行 `jar`，**无需解压**；将 `skill-gateway-0.0.1-SNAPSHOT.jar` 与 `application-prod.properties` 上传到同一目录即可。

```bash
mkdir -p /opt/fishtank/skill-gateway
mkdir -p /opt/fishtank/data
```

将 `jar` 和配置文件上传到 `/opt/fishtank/skill-gateway` 后，执行：

```bash
cd /opt/fishtank/skill-gateway
export JAVA_GATEWAY_TOKEN=your-secure-token-here
java -jar skill-gateway-0.0.1-SNAPSHOT.jar \
  --spring.config.location=/opt/fishtank/skill-gateway/application-prod.properties
```

### 6.4 本机健康检查

在服务器上 **`agent-core` 与 `skill-gateway` 均已启动**（手动或 systemd，见第 7 节）后，可用下面命令确认本机端口正常；若连接被拒绝，多为进程未启动、路径未解压完整，或端口与 `.env` / `application-prod.properties` 不一致。

```bash
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:18080/api/health
```

## 7. systemd 托管

仓库已提供两个示例服务文件：

- `deploy/systemd/agent-core.service`
- `deploy/systemd/skill-gateway.service`

使用前建议检查以下内容是否需要修改：

- `WorkingDirectory`
- `ExecStart`
- `Environment`
- `EnvironmentFile`

### 7.1 agent-core.service 示例

建议在现有示例基础上补充环境文件：

```ini
[Unit]
Description=Fishtank agent-core
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/fishtank/agent-core
ExecStart=/usr/bin/node /opt/fishtank/agent-core/dist/main.js
Environment=NODE_ENV=production
EnvironmentFile=/opt/fishtank/agent-core/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 7.2 skill-gateway.service 示例

建议根据实际 token 增加环境变量：

```ini
[Unit]
Description=Fishtank skill-gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/fishtank/skill-gateway
Environment=JAVA_GATEWAY_TOKEN=your-secure-token-here
ExecStart=/usr/bin/java -jar /opt/fishtank/skill-gateway/skill-gateway-0.0.1-SNAPSHOT.jar --spring.config.location=/opt/fishtank/skill-gateway/application-prod.properties
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 7.3 systemd 启用命令

```bash
cp deploy/systemd/agent-core.service /etc/systemd/system/
cp deploy/systemd/skill-gateway.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now agent-core
systemctl enable --now skill-gateway
```

如果 `node` 或 `java` 不在 `/usr/bin`，请先修改 `ExecStart`。

## 8. nginx 配置

仓库中已提供单域名示例：

- `deploy/nginx/fishtank.single-host.conf`

可部署为例如 `/etc/nginx/conf.d/fishtank.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    root /opt/fishtank/frontend/dist;
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

加载配置：

```bash
nginx -t
systemctl reload nginx
```

如果已经有 HTTPS 证书，可以在此基础上增加 `443 ssl` 配置。

## 9. 启动顺序

建议启动顺序如下：

1. 启动 `mem0` 或确认远端 `mem0` 可用
2. 启动 `agent-core`
3. 启动 `skill-gateway`
4. 启动或重载 `nginx`
5. 浏览器访问前端并做联调验证

## 10. 上线后验证

### 10.1 验证 Agent Core

健康检查接口：

```bash
curl http://127.0.0.1:3000/health
```

预期返回类似：

```json
{
  "status": "ok",
  "service": "agent-core",
  "timestamp": "2026-03-25T00:00:00.000Z",
  "uptimeSeconds": 12
}
```

### 10.2 验证 Skill Gateway

健康检查接口：

```bash
curl http://127.0.0.1:18080/api/health
```

也可以验证公开技能列表：

```bash
curl http://127.0.0.1:18080/api/skills
```

### 10.3 验证 Frontend

浏览器访问：

```text
https://your-domain.example.com/
```

重点检查：

- 页面是否正常打开
- 登录、注册接口是否正常
- 聊天任务是否能成功创建
- SSE 流是否正常返回
- 欢迎语和头像生成接口是否可用

## 11. 常见问题

### 11.1 前端页面能打开，但请求仍打到 `localhost`

原因通常是：

- 没有正确创建 `frontend/.env.production`
- 构建时未读取最新环境变量
- 上传了旧的 `dist/`

处理方式：

```bash
cd frontend
npm run build
```

然后重新上传 `dist/`。

### 11.2 Agent Core 启动时报 `Cannot find module`

通常检查以下几项：

- `node_modules/` 是否一起上传
- 当前启动目录是否正确
- 构建平台是否与目标服务器一致

### 11.3 Skill Gateway 能启动，但 Agent 调用技能接口返回 `401`

优先检查：

- `agent-core` 中的 `JAVA_GATEWAY_TOKEN`
- `skill-gateway` 进程环境中的 `JAVA_GATEWAY_TOKEN`
- 两边是否完全一致

### 11.4 前端跨域失败

优先检查：

- `app.cors.allowed-origins`
- 浏览器访问域名是否与配置完全一致
- 是否通过 `nginx` 同域代理访问

### 11.5 Skill Gateway 调不到 Agent Core

优先检查：

- `agent.core.url`
- `agent-core` 进程是否正常
- `curl http://127.0.0.1:3000/health`

### 11.6 Agent Core 调不到大模型或记忆服务

优先检查：

- `OPENAI_API_KEY`
- `OPENAI_API_BASE`
- `OPENAI_MODEL_NAME`
- `MEM0_URL`
- 服务器出网权限和目标地址连通性

### 11.7 Skill Gateway 启动失败：`Table "SKILLS" not found`（`schema.sql`）

典型堆栈：`BeanCreationException` → `dataSourceScriptDatabaseInitializer` → `UPDATE skills SET requires_confirmation ...`。

原因：`spring.sql.init.mode=always` 会执行 `schema.sql`，其中的 `UPDATE skills` 要求表已由 Hibernate 建好。若 **`spring.jpa.defer-datasource-initialization` 未设为 `true`**，`schema.sql` 会在空库上先于 Hibernate 执行，就会报「表不存在」（MySQL 下为 `skills` 不存在等类似错误）。

常见触发方式：启动命令使用 `--spring.config.location=.../application-prod.properties` 时，**只会加载该文件**，JAR 里 `application.properties` 中的 `defer-datasource-initialization=true` 不会生效；若生产 properties 是从文档复制的旧片段且漏了该项，就会复现。

处理：在 `application-prod.properties` 中增加（或核对）与 `backend/skill-gateway/src/main/resources/application-prod.example.properties` 一致：

```properties
spring.jpa.defer-datasource-initialization=true
```

也可改用 `--spring.config.additional-location=...` 在保留 JAR 默认配置的基础上叠加生产文件（以你实际 Spring Boot 版本行为为准）。

## 12. 变更配置后的重启建议

修改配置后，建议按以下顺序重启：

1. 若修改了 `agent-core/.env`，重启 `agent-core`
2. 若修改了 `application-prod.properties` 或 `JAVA_GATEWAY_TOKEN`，重启 `skill-gateway`
3. 若重新构建了前端，覆盖 `frontend/dist` 后重载 `nginx`
4. 若修改了 `nginx` 配置，执行 `nginx -t && systemctl reload nginx`

这样可以把三端部署、配置修改、反向代理和验证流程串成一套完整闭环。
