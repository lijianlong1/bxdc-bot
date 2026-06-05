## Context

agent-core 当前在 [main.ts](file:///Users/zhangzhuang/ai/gitbbxdc-bot/bxdc-bot/backend/agent-core/src/main.ts#L58) 使用 `app.enableCors()` 无参调用，NestJS 默认将所有 CORS 头设为 open：`Access-Control-Allow-Origin: *`（反射请求中的 Origin），允许任意跨域访问。

生产环境中，agent-core (端口 3000) 通过 serve-proxy (端口 8080) 代理，前端使用同源请求，不直接触发 CORS。但直接暴露的端口仍存在安全风险。

## Goals / Non-Goals

**Goals:**
- 通过 `.env` 环境变量配置 CORS 白名单，拒绝未授权的跨域请求
- 避免盲目反射 Origin 头
- 添加 `Vary: Origin` 头，避免代理缓存混淆
- 不破坏现有前端→serve-proxy→agent-core 的正常通信

**Non-Goals:**
- 不修改 serve-proxy 或前端代码
- 不修改 skill-gateway 的 CORS 策略
- 不引入新的中间件或第三方库

## Decisions

### 1. 白名单模式替代通配符

**选择**: 通过 `CORS_ALLOWED_ORIGINS` 环境变量配置逗号分隔的域名白名单，`main.ts` 在启动时解析为数组传入 NestJS CORS 配置。

**理由**: NestJS CORS 模块原生支持 `origin` 回调函数，一行代码即可实现白名单校验，无需额外依赖。

**备选方案**: 使用 `@nestjs/platform-express` 的自定义中间件 — 更复杂，无额外收益。

### 2. 默认值与兼容性

**选择**: 若未配置 `CORS_ALLOWED_ORIGINS`，回退到 `['http://localhost:8080', 'http://127.0.0.1:8080']` 作为安全默认值。

**理由**: 保证开发环境零配置可用，同时避免生产遗漏配置时的 `*` 回退。

### 3. Vary 头

NestJS CORS 在非通配符模式下自动为 OPTIONS 预检请求响应添加 `Vary: Origin` 头。无需额外的自定义中间件。

## Risks / Trade-offs

- **风险**: 部署时若忘记配置 `CORS_ALLOWED_ORIGINS`，默认只允许 `localhost:8080`，外部客户端无法跨域访问 → **缓解**: 在 `.env` 中预置 `localhost` 和 `127.0.0.1` 的常见格式
- **风险**: Skill-gateway 通过 HTTP 调用 agent-core（同域 127.0.0.1），不涉及 CORS，无影响
