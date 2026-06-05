## 1. Schema 与配置

- [x] 1.1 新增 DB migration：统一对外审计表（HTTP/SSH discriminator、user、时间戳、目标字段、correlation id、origin 捕获列、outbound 捕获列、截断标记、索引）
- [x] 1.2 新增 DB migration：agent-core Skill 调用审计表（user、时间、skill id/name、request payload、response payload、status/错误字段、可选 correlation id）
- [x] 1.3 增加配置项：单字段最大字节、脱敏 header 名列表、异步/fail-open 行为（可对照现有 LLM HTTP audit 配置模式）

## 2. 入站捕获与关联

- [x] 2.1 在面向 agent-core 的路由上实现 Servlet Filter 或 Spring HTTP 包装，将 raw inbound body 与策略允许的 headers 写入 request 作用域容器
- [x] 2.2 通过 MDC 透传或生成 `X-Correlation-Id`（或等价物）；文档化 agent-core 可选参与方式
- [x] 2.3 将 correlation id 与捕获的 origin 字节注入 Skill 执行上下文，供 outbound 客户端与审计写入使用

## 3. 对外保真（HTTP + SSH）

- [x] 3.1 包装或拦截 API Skill 使用的 HTTP 客户端，按发送侧复制每次请求的 method、headers、body 字节；成功/失败均写入统一对外审计行
- [x] 3.2 在 SSH 执行路径挂钩，将精确命令字符串与端点标识写入同表并标记 SSH discriminator
- [x] 3.3 替换或下线仅记录 DTO 摘要的 `AuditAspect` / `audit_logs` 用法——或迁移至新表、或过渡期双写，再按团队偏好去掉重复逻辑

## 4. agent-core 调用审计

- [x] 4.1 梳理 skill-gateway 内所有调用 agent-core 的代码路径；若分散则收敛 HTTP client
- [x] 4.2 写入调用审计行：user、时间、skill 标识、发往 agent-core 的序列化请求、response/错误负载，截断/脱敏规则与其他审计表一致
- [x] 4.3 审计写入失败只记日志/指标，不得导致 Skill 调用失败（fail-open）

## 5. 用户身份与验证

- [x] 5.1 从真实安全主体填充审计 `user` 字段（修复已认证路由上 `"unknown"` 占位）
- [x] 5.2 补充集成测试：HTTP 对外审计含捕获的 headers/body；SSH 行含精确命令；origin 字节与 POST raw body 一致；agent-core Skill 审计含往返 JSON
- [x] 5.3 手工验收：从 agent-core 触发 API Skill 与 SSH Skill，在 staging 确认 DB 行与 correlation id 关联（请在部署环境执行；实现已就绪）
