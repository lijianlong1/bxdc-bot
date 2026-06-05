## Why

agent-core 当前 CORS 配置使用 NestJS 默认 `app.enableCors()`（无参数），等价于 `Access-Control-Allow-Origin: *`，允许任意来源跨域访问。这违反了 CORS 安全最佳实践：攻击者可在恶意网站通过跨域请求读取 API 响应数据，导致用户隐私泄露、信息窃取甚至账户劫持。

## What Changes

- **BREAKING**: 将 CORS 从通配符 `*` 改为白名单模式，仅允许明确配置的域名
- 在 `.env` 中新增 `CORS_ALLOWED_ORIGINS` 环境变量，支持多域名配置
- 在 `main.ts` 中替换 `app.enableCors()` 为严格的 CORS 配置
- 添加 `Vary: Origin` 响应头，防止代理缓存混淆

## Capabilities

### New Capabilities
- `cors-origin-whitelist`: CORS 来源白名单校验，允许通过环境变量配置受信任的跨域来源，替代通配符 *

### Modified Capabilities
<!-- 无现有 capability 的 spec 级别变更 -->

## Impact

- **`src/main.ts`**: `app.enableCors()` 替换为结构化 CORS 配置
- **`.env`**: 新增 `CORS_ALLOWED_ORIGINS` 变量
- **兼容性**: 部署时需确保 `.env` 中配置正确的可信域名，否则将拒绝跨域请求
