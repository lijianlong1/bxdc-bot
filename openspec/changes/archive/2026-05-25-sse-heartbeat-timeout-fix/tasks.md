## 1. SSE 心跳

- [x] 1.1 在 `TaskController.streamTaskEvents` 中新增 `ScheduledExecutorService` 心跳线程
- [x] 1.2 每 30 秒发送 `SseEmitter.event().comment("")`（SSE 空注释）
- [x] 1.3 在 `subscribe` 的 `error` 回调中 `heartbeat.cancel(true)` + `heartbeatExecutor.shutdown()`
- [x] 1.4 在 `subscribe` 的 `complete` 回调中同上
- [x] 1.5 在 `emitter.onCompletion` 中同上
- [x] 1.6 在 `emitter.onTimeout` 中同上

## 2. Spring MVC 超时

- [x] 2.1 `application.properties` 新增 `spring.mvc.async.request-timeout=-1`
- [x] 2.2 `application-prod.example.properties` 同步新增

## 3. nginx 配置

- [x] 3.1 `/api/` location 新增 `proxy_read_timeout 600s`
- [x] 3.2 `/api/` location 新增 `proxy_buffering off`

## 4. 验证

- [ ] 4.1 服务器部署后，执行异步轮询 Skill，确认等待 2+ 分钟不会断连
- [ ] 4.2 观察 nginx access log 确认 SSE 连接时长
