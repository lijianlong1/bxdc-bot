# 基础镜像（稳定版）
FROM hub.c.163.com/library/ubuntu:22.04
WORKDIR /app

# 禁止交互
ENV DEBIAN_FRONTEND=noninteractive

# 添加国内镜像源
RUN sed -i 's/http:\/\/archive\.ubuntu\.com\/ubuntu\//http:\/\/mirrors\.aliyun\.com\/ubuntu\//g' /etc/apt/sources.list
RUN sed -i 's/http:\/\/security\.ubuntu\.com\/ubuntu\//http:\/\/mirrors\.aliyun\.com\/ubuntu\//g' /etc/apt/sources.list

# 1. 安装 JDK21 和 Maven
RUN apt-get update && apt-get install -y openjdk-21-jre maven && rm -rf /var/lib/apt/lists/*

# 2. 安装 Node.js 24
RUN apt-get update && apt-get install -y vim curl gnupg && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 3. 安装 Nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# 4. 复制项目到镜像（包含前端+后端）
COPY ./backend/agent-core /app/backend/agent-core
COPY ./backend/skill-gateway /app/backend/skill-gateway
COPY ./frontend /app/frontend

# agent-core
WORKDIR /app/backend/agent-core
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps && npm run build

# skill-gateway
WORKDIR /app/backend/skill-gateway
RUN mkdir -p ~/.m2 && echo '<settings><mirrors><mirror><id>aliyun</id><url>https://maven.aliyun.com/repository/public</url><mirrorOf>central</mirrorOf></mirror></mirrors></settings>' > ~/.m2/settings.xml && mvn clean package -DskipTests

# frontend
WORKDIR /app/frontend
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps && npm run build

# 5. 替换 Nginx 配置
COPY ./nginx.conf /etc/nginx/nginx.conf

# 6. 创建启动脚本
COPY ./start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 7. 暴露 18080 3000 80 端口
EXPOSE 18080 3000 80

# 启动服务
CMD ["/app/start.sh"]