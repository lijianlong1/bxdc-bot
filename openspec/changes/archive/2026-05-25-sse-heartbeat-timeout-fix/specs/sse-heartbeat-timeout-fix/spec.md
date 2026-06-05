# sse-heartbeat-timeout-fix Specification

## Purpose

约定 SSE 长连接在异步轮询期间通过心跳保活，及配套的 nginx / Tomcat 超时参数加固，确保无论轮询等待多久 SSE 连接不断开。

## ADDED Requirements

### Requirement: SSE 心跳保活

SseEmitter 实例 SHALL 每 30 秒发送一条 SSE 注释（`:`），确保 TCP 层持续有数据流动，防止中间代理/容器判定连接空闲而强制关闭。

#### Scenario: 异步轮询期间心跳正常

- **WHEN** agent-core 正在执行异步轮询 Skill（`GET /api/skills/async-tasks/{id}/wait` 阻塞等待中）
- **THEN** SSE 流 SHALL 每 30 秒收到一条空注释 `:`
- **AND** EventSource（浏览器）SHALL 自动忽略该注释，不触发 `onmessage`
- **AND** nginx / Tomcat SHALL 因有数据传输而重置空闲超时计时器

#### Scenario: SSE 流正常数据优先

- **WHEN** agent-core 返回 SSE 数据（`tool_status`、`agent_message` 等）
- **THEN** 数据 SHALL 即时通过 emitter 发送
- **AND** 心跳 SHALL NOT 阻塞或延迟数据发送
- **AND** 心跳与正常数据由独立线程调度，互不干扰

#### Scenario: 心跳线程清理

- **WHEN** SSE 流因任何原因结束（正常完成 / 错误 / 超时 / 客户端断开）
- **THEN** 心跳调度器 SHALL 被 `cancel(true)` 取消
- **AND** 心跳线程池 SHALL 被 `shutdown()` 回收
- **AND** SHALL NOT 残留后台线程

### Requirement: Spring MVC 异步请求不超时

skill-gateway 的 `application.properties` SHALL 配置 `spring.mvc.async.request-timeout=-1`，禁用 Tomcat 级别的异步请求超时。

#### Scenario: 异步请求长时间无数据不断开

- **WHEN** SSE 流在 30 秒以上无业务数据（仅心跳）
- **THEN** Tomcat SHALL NOT 强制完成异步请求
- **AND** SseEmitter SHALL 保持打开状态

### Requirement: nginx 代理 SSE 长连接不断开

nginx 的 `/api/` location SHALL 配置 `proxy_read_timeout 600s` 和 `proxy_buffering off`。

#### Scenario: nginx 不缓冲 SSE 数据

- **WHEN** nginx 代理 SSE 流
- **THEN** `proxy_buffering off` SHALL 确保数据实时推送到客户端
- **AND** SHALL NOT 积压在 nginx 缓冲区

#### Scenario: nginx 读取超时足够长

- **WHEN** SSE 流在 60 秒以上无业务数据
- **THEN** `proxy_read_timeout 600s` SHALL 防止 nginx 判定后端无响应
- **AND** 连接 SHALL 保持直到 SSE 流正常结束

### Requirement: 三层防御

SSE 连接稳定性 SHALL 由三层机制共同保障。

#### Scenario: 任一层生效即可保活

- **WHEN** 心跳线程正常工作
- **THEN** 即使 nginx 和 Tomcat 使用默认超时配置，SSE 连接 SHALL 不断
- **WHEN** 心跳线程意外失效，但 `spring.mvc.async.request-timeout=-1` 生效
- **THEN** Tomcat SHALL NOT 断开连接
- **WHEN** 心跳和 Tomcat 配置均失效，但 nginx `proxy_read_timeout 600s` 生效
- **THEN** nginx SHALL 保持连接最长 10 分钟
