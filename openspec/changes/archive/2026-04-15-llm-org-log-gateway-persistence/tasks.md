## 1. skill-gateway 数据模型与持久化

- [x] 1.1 新增实体与 JPA 仓库（表名与列：`user_id`、`recorded_at`、`correlation_id`、`direction`、HTTP 元数据、body 等，与 design 一致）
- [x] 1.2 在 `schema.sql`（或迁移脚本）中创建表与索引（`user_id`、`recorded_at`）
- [x] 1.3 实现 Service：接收 DTO、脱敏策略与网关侧校验（可选与 agent 侧对齐），写入数据库

## 2. skill-gateway HTTP API 与安全

- [x] 2.1 新增 Controller：`POST` 审计写入端点，请求体 schema 与 agent-core 上报格式对齐
- [x] 2.2 将端点纳入 `SecurityConfig` / `ApiTokenFilter`：与现有 `JAVA_GATEWAY_TOKEN` 校验一致，拒绝未授权写入
- [x] 2.3（可选）限制请求体大小，防止 oversized payload

## 3. agent-core 上报与上下文

- [x] 3.1 新增环境变量（例如远程持久化开关、网关 URL，与现有 `JAVA_GATEWAY_URL`/`JAVA_GATEWAY_TOKEN` 复用或扩展）并更新 `.env.example` / 部署文档
- [x] 3.2 扩展 `composeOpenAiCompatibleFetch` / `getLoggingFetchOrUndefined` 注入路径：传入 `userId`、`sessionId`（来自 `AgentFactory.createAgent` 与 `context`）
- [x] 3.3 在 `llm-raw-http-log` 中于记录请求/响应后异步 `fetch` POST 至 skill-gateway（失败不抛、不阻塞 LLM）；载荷含用户标识、关联 id、方向、截断 body 等
- [x] 3.4 确认 agent-core 未引入任何数据库驱动或数据源配置

## 4. 验证与文档

- [x] 4.1 本地或集成测试：开启开关后 DB 中出现预期行，`user_id`/`recorded_at` 正确；关闭开关无写入
- [x] 4.2 更新 `docs/` 或现有部署说明：敏感数据风险、配置项、拓扑（agent-core → gateway → DB）
- [x] 4.3（可选）为网关端点添加单元/集成测试（MockMvc + 内存库或 Testcontainers）
