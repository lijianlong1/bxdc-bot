# BXDC Bot 镜像构建与部署指南

## 项目结构

本项目包含三个核心服务，每个服务对应一个独立的Docker镜像：

1. **skill-gateway**：Java后端服务，处理业务逻辑和API请求
2. **agent-core**：Node.js后端服务，处理AI相关功能（更新频繁）
3. **frontend**：前端服务，使用Nginx部署Vue应用（更新频繁）

## 镜像构建

### 1. 准备工作

确保项目根目录包含以下文件：
- `Dockerfile.skill-gateway`：skill-gateway服务的构建配置
- `Dockerfile.agent-core`：agent-core服务的构建配置
- `Dockerfile.frontend`：frontend服务的构建配置
- `docker-compose.yaml`：服务编排配置
- `nginx.conf`：Nginx配置文件

### 2. 构建命令

在项目根目录执行以下命令构建所有镜像：

```bash
# 构建所有镜像
docker-compose build

# 或单独构建某个镜像
docker-compose build skill-gateway
docker-compose build agent-core
docker-compose build frontend
```

## 服务配置

### 1. skill-gateway 服务

- **基础镜像**：`eclipse-temurin:21-jdk-alpine`（轻量级Java环境）
- **构建过程**：
  - 安装Maven
  - 复制项目文件
  - 使用国内Maven镜像构建项目
  - 启动Java应用
- **端口**：18080

### 2. agent-core 服务

- **基础镜像**：`node:24-alpine`（轻量级Node.js环境）
- **构建过程**：
  - 安装必要依赖
  - 复制项目文件
  - 使用国内npm镜像安装依赖并构建项目
  - 启动Node.js应用
- **端口**：3000

### 3. frontend 服务

- **基础镜像**：
  - 构建阶段：`node:24-alpine`
  - 部署阶段：`nginx:alpine`
- **构建过程**：
  - 第一阶段：安装依赖并构建前端项目
  - 第二阶段：复制构建产物到Nginx目录，配置Nginx
  - 启动Nginx服务
- **端口**：80

## 环境变量配置

在`docker-compose.yaml`中配置以下环境变量：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PORT` | agent-core服务端口 | 3000 |
| `HOST` | agent-core服务主机 | 0.0.0.0 |
| `MEM0_URL` | 记忆服务URL | http://39.104.81.41:8001 |
| `OPENAI_API_BASE` | 大模型API代理地址 | - |
| `OPENAI_API_KEY` | 大模型API密钥 | - |
| `OPENAI_MODEL_NAME` | 大模型名称 | gpt-4 |
| `JAVA_GATEWAY_URL` | Java网关URL | http://skill-gateway:18080 |
| `JAVA_GATEWAY_TOKEN` | Java网关认证令牌 | your-secure-token-here |
| `AGENT_SKILLS_DIRS` | 技能目录 | - |

### 运行时配置

可以通过环境变量覆盖默认配置：

```bash
# 示例：配置记忆服务和大模型API
MEM0_URL=http://your-mem0-server:port OPENAI_API_BASE=http://your-proxy-server:port docker-compose up -d
```

## 启动与验证

### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 验证服务

- **前端**：访问 http://localhost
- **API接口**：访问 http://localhost/api/
- **健康检查**：
  - agent-core：http://localhost/health-agent
  - skill-gateway：http://localhost/health-gateway

### 查看日志

```bash
# 查看服务日志
docker logs bxdc-bot-skill-gateway
docker logs bxdc-bot-agent-core
docker logs bxdc-bot-frontend
```

## 离线移植

### 导出镜像

```bash
# 导出各个镜像
docker save -o skill-gateway-image.tar bxdc-bot_skill-gateway
docker save -o agent-core-image.tar bxdc-bot_agent-core
docker save -o frontend-image.tar bxdc-bot_frontend
```

### 导入镜像

在目标环境中执行：

```bash
# 导入镜像
docker load -i skill-gateway-image.tar
docker load -i agent-core-image.tar
docker load -i frontend-image.tar

# 启动服务
docker-compose up -d
```

## 优化构建过程（针对频繁更新的镜像）

对于更新频繁的`agent-core`和`frontend`镜像，可以采用以下优化方法：

### 1. 使用Docker缓存

Docker会缓存构建步骤，只有当Dockerfile或相关文件发生变化时才会重新执行相应步骤。确保将不常变化的步骤放在前面，变化频繁的步骤放在后面。

### 2. 使用挂载卷进行开发

对于开发环境，可以使用挂载卷将本地代码目录挂载到容器中，这样可以实时看到代码变化，而不需要重新构建镜像。

#### 为agent-core添加挂载卷

修改`docker-compose.yaml`：

```yaml
agent-core:
  build:
    context: .
    dockerfile: Dockerfile.agent-core
  ports:
    - "3000:3000"
  volumes:
    - ./backend/agent-core:/app
    - /app/node_modules  # 避免覆盖容器中的node_modules
  environment:
    # 环境变量配置
  depends_on:
    - skill-gateway
  restart: unless-stopped
```

#### 为frontend添加挂载卷

修改`docker-compose.yaml`：

```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile.frontend
  ports:
    - "80:80"
  volumes:
    - ./frontend:/app
    - /app/node_modules  # 避免覆盖容器中的node_modules
  depends_on:
    - agent-core
    - skill-gateway
  restart: unless-stopped
```

### 3. 仅构建变化的部分

当只修改了前端代码时，只构建frontend镜像：

```bash
docker-compose build frontend
```

当只修改了agent-core代码时，只构建agent-core镜像：

```bash
docker-compose build agent-core
```

### 4. 使用多阶段构建优化前端镜像

前端镜像已经使用了多阶段构建，确保最终镜像只包含必要的文件，减小镜像大小。

### 5. 预安装依赖

对于`agent-core`和`frontend`，可以在Dockerfile中先复制`package.json`文件并安装依赖，然后再复制其他代码文件。这样，当只有代码文件变化时，依赖安装步骤会使用缓存。

#### 修改Dockerfile.agent-core

```dockerfile
# 基础镜像（轻量级）
FROM node:24-alpine
WORKDIR /app

# 更换为国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装必要的依赖
RUN apk add --no-cache bash

# 先复制package.json文件
COPY ./backend/agent-core/package.json /app/

# 安装依赖
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps

# 复制其他代码文件
COPY ./backend/agent-core /app

# 构建项目
RUN npm run build

# 暴露 3000 端口
EXPOSE 3000

# 启动服务
CMD ["node", "dist/main.js"]
```

#### 修改Dockerfile.frontend

```dockerfile
# 第一阶段：构建前端
FROM node:24-alpine as builder
WORKDIR /app

# 更换为国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 先复制package.json文件
COPY ./frontend/package.json /app/

# 安装依赖
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps

# 复制其他代码文件
COPY ./frontend /app

# 构建项目
RUN npm run build

# 第二阶段：部署前端
FROM nginx:alpine

# 更换为国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 复制构建好的前端文件
COPY --from=builder /app/dist /usr/share/nginx/html

# 替换 Nginx 配置
COPY ./nginx.conf /etc/nginx/nginx.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
```

## 注意事项

1. **容器间通信**：使用服务名称作为主机名进行通信（如`http://skill-gateway:18080`）
2. **构建优化**：使用国内镜像源加速依赖下载
3. **多阶段构建**：frontend服务使用多阶段构建减小镜像大小
4. **健康检查**：通过健康检查端点验证服务状态
5. **环境变量**：通过环境变量灵活配置服务参数

## 故障排查

### 常见问题

1. **容器启动失败**：查看日志确认错误原因
2. **服务间通信失败**：检查网络配置和服务状态
3. **依赖下载失败**：确保网络连接正常，或使用国内镜像源
4. **端口冲突**：确保主机端口未被占用

### 解决方法

- **查看容器日志**：`docker logs <容器名>`
- **测试容器间通信**：`docker exec -it <容器名> curl <服务地址>`
- **检查服务状态**：`docker-compose ps`
- **重启服务**：`docker-compose restart <服务名>`

## 开发工作流

1. **初始化**：首次构建所有镜像
2. **开发**：使用挂载卷实时查看代码变化
3. **测试**：在本地验证服务功能
4. **构建**：仅构建变化的部分
5. **部署**：导出镜像到目标环境

通过以上步骤，您可以成功构建和部署BXDC Bot的三个镜像，实现完整的AI助手功能，同时优化开发和构建过程，提高效率。



更新代码测试
1.构建相关的镜像文件

docker-compose build agent-core
docker-compose build frontend
docker-compose up -d 完成镜像的重启
测试处理
- 测试agent-core服务
- 测试frontend服务
- 测试skill-gateway服务