## Why

异步轮询 Skill 执行期间，agent-core 调 `GET /api/skills/async-tasks/{id}/wait`（最长等待 300 秒）阻塞等待，期间 SSE 流（`/api/tasks/{id}/events`）**没有任何数据传输**。这导致：

1. **nginx `proxy_read_timeout` 默认 60s** → 60 秒无数据断连
2. **Tomcat `spring.mvc.async.request-timeout` 默认 30s** → 30 秒无数据断连
3. 后端轮询正常完成、数据库状态正确更新，但由于 SSE 连接已断，前端收到 `readyState: 0` 报错

本地直连（无 nginx，可能 Tomcat 配置不同）不受影响，仅服务器部署环境触发。

## What Changes

- **BREAKING（运行时行为）**：SseEmitter 新增 30s 间隔心跳（SSE `:` 注释），确保 TCP 层始终有数据流动
- **nginx**：`/api/` location 增加 `proxy_read_timeout 600s` + `proxy_buffering off`
- **Spring Boot**：`application.properties` 增加 `spring.mvc.async.request-timeout=-1`

三层防护，任一层生效即可保 SSE 不断。

## Capabilities

### New Capabilities

- `sse-heartbeat-timeout-fix`：SSE 长连接稳定性，异步轮询期间心跳保活，nginx/Tomcat 超时参数加固

### Modified Capabilities

（无；不影响任何业务能力。）

## Impact

| 文件 | 改动 |
|------|------|
| `backend/skill-gateway/src/main/java/.../controller/TaskController.java` | SSE emitter 新增 `ScheduledExecutorService` 30s 心跳，所有退出路径销毁心跳线程 |
| `backend/skill-gateway/src/main/resources/application.properties` | 新增 `spring.mvc.async.request-timeout=-1` |
| `backend/skill-gateway/src/main/resources/application-prod.example.properties` | 同上 |
| `deploy/nginx/fishtank.single-host.conf` | `/api/` location 新增 `proxy_read_timeout 600s` + `proxy_buffering off` |
