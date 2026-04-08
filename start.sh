#!/bin/bash

# 启动 skill-gateway
cd /app/backend/skill-gateway
java -jar target/skill-gateway-1.0-SNAPSHOT.jar &

# 等待 skill-gateway 启动
sleep 5

# 启动 agent-core
cd /app/backend/agent-core
npm start &

# 等待 agent-core 启动
sleep 5

# 启动 Nginx
service nginx start

# 保持容器运行
wait