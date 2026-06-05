## 1. 环境变量配置

- [x] 1.1 在 `.env` 中新增 `CORS_ALLOWED_ORIGINS` 变量，默认值包含 `http://localhost:8080` 和 `http://127.0.0.1:8080`

## 2. CORS 配置代码修改

- [x] 2.1 修改 `src/main.ts`：将 `app.enableCors()` 替换为严格的白名单 CORS 配置，读取 `CORS_ALLOWED_ORIGINS` 环境变量

## 3. 验证

- [x] 3.1 启动服务后，验证白名单内 Origin 跨域请求正常返回 `Access-Control-Allow-Origin`
- [x] 3.2 验证白名单外 Origin 跨域请求不包含 `Access-Control-Allow-Origin` 头
- [x] 3.3 验证 OPTIONS 预检请求返回 `Vary: Origin` 头
