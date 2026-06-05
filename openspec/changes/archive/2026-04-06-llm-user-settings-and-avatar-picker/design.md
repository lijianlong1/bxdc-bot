## Context

当前 `agent-core` 在 `agent.controller` 等处从 `process.env` 读取 `OPENAI_API_KEY`、`OPENAI_MODEL_NAME`、`OPENAI_API_BASE`，`skill-gateway` 负责任务与用户体系。头像相关逻辑分散在 `UserController`/`features/avatar` 与注册流程中，默认依赖 LLM 生成 emoji。目标是在不强制重启服务的前提下，让用户级配置在请求路径上覆盖全局环境变量，同时把头像交互改为用户可控。

## Goals / Non-Goals

**Goals:**

- 登录用户可在前端配置 OpenAI 兼容的 base URL、模型名、API Key，并持久化在服务端。
- 执行 Agent 任务、以及需要调用用户所选 LLM 的附属能力（如显式「生成头像」）时，对已登录用户**以持久化用户配置为权威来源**做字段级合并（用户非空字段覆盖 `OPENAI_*` env），确保用户保存设置后能实际用同一套参数访问 LLM。
- 注册/资料场景：默认通过 emoji 选择器选择头像；用户可点击「自动生成」再调用 LLM。
- API Key 在 GET 响应中掩码或不返回，仅支持写入与更新。

**Non-Goals:**

- 不在首版实现多租户管理员代配、团队级 Key 池或计费。
- 不把 API Key 明文存于浏览器 localStorage 作为唯一数据源（服务端持久化为准）。
- 不强制替换 mem0 等外部服务地址；若记忆侧 Judge 仍用全局 env，可在实现阶段尽量与用户主对话配置对齐，文档中可列为后续优化。

## Decisions

1. **用户 LLM 设置存储于 skill-gateway（H2/DB）**
   - **决定**：以 `userId` 为主键扩展表或 JSON 字段，存储 `apiBase`、`modelName`、`apiKey`；**首版 API Key 以明文落库，不做字段级加密**（依赖部署侧 DB 访问控制与 HTTPS）。
   - **理由**：用户与认证已在 Java 侧，便于与 JWT 鉴权统一；`agent-core` 通过受控接口或任务上下文携带解析后的配置。
   - **替代方案**：仅存 agent-core 本地文件 — 难以与多实例网关一致。

2. **agent-core 通过 userId 拉取或合并配置**
   - **决定**：在 `runTask` 等入口根据 `context.userId` 调用网关内部 API 或接收网关注入的 LLM 配置快照；合并规则为「用户字段非空则覆盖 env」。**只要用户已保存过配置，必须先加载用户行再 merge**，避免仍用旧 env 导致「页面上已配好、实际请求未走用户配置」。
   - **理由**：单一真相在网关，agent 无状态扩展；保障用户保存后能访问到 LLM。
   - **替代方案**：前端每次把 Key 打在请求体 — 易泄露且难审计。

3. **头像：默认 UI 为 emoji picker，LLM 为显式按钮**
   - **决定**：注册/编辑资料页展示 emoji 网格或分类选择器；「自动生成」按钮调用现有或精简后的 `POST /user/avatar`（或等价能力），使用与用户主对话一致的 **merge 后** LLM 参数。
   - **理由**：满足「取消自动生成、改为自选或按钮生成」。
   - **替代方案**：完全移除 LLM 头像 — 用户明确要求保留按钮生成。

4. **无 API Key 时禁用「自动生成头像」**
   - **决定**：前端在合并解析后的 API Key 为空时 **MUST** 禁用「自动生成」按钮（不发起请求）；合并规则与主对话一致（用户字段 + env 回退后仍无 Key 则视为无 Key）。
   - **理由**：避免无意义的失败请求与困惑；与「显式操作才调 LLM」一致。

5. **密钥展示**
   - **决定**：GET 设置接口返回 `apiKeyMasked` 或 `hasApiKey` 布尔，不返回完整 Key；PUT 支持整段替换或「空字符串表示不修改」。
   - **理由**：防止 XSS/日志泄露扩大面。

## Risks / Trade-offs

- **[Risk] 用户配置错误导致全站不可用体验** → **Mitigation**：任务失败时返回明确错误；设置页提供「测试连接」可选（后续迭代）。
- **[Risk] 密钥明文落库** → **Mitigation**：首版接受明文，依赖 DB 访问控制、HTTPS、禁止在日志/SSE 打印 Key；后续可升级为字段加密。
- **[Risk] 网关与 agent 配置不一致** → **Mitigation**：契约测试与单一 `userId` 贯穿任务上下文。
- **[Trade-off]** 全局 env 仍可作为部署默认，适合未登录或内部运维场景。

## Migration Plan

1. 增加 DB 迁移与用户表字段或关联表。
2. 实现网关 REST + agent 侧读取逻辑，默认仍走 env。
3. 前端设置页与注册/头像 UI 改造。
4. 文档更新 `.env` 说明与「用户覆盖」说明。
5. 回滚：关闭前端设置入口，清空表或忽略用户列，进程仍仅用 env。

## Open Questions

- （已决）字段加密：首版不做，见 Decisions 第 1 条。
- （已决）生成头像：无可用 API Key（merge 后为空）时禁用按钮，见 Decisions 第 4 条。
