## 1. agent-core：为代理调用附加 `X-User-Id`

- [x] 1.1 为 `executeConfiguredApiSkill` 增加参数 `userId?: string`（或等价在内部构建与 `gatewaySkillReadHeaders` 一致的入站头），在 `axios.post(\`${gatewayUrl}/api/skills/api\`...)` 的 `headers` 中于 `userId` 非空时设置 `X-User-Id`。
- [x] 1.2 为 `executeCurrentTimeSkill` 增加 `userId?: string` 并同样在请求 Gateway 时附带 `X-User-Id`（与 1.1 规则一致）。
- [x] 1.3 在 `loadGatewayExtendedTools` 中调用 1.1 / 1.2 时**传入**已有的 `userId` 闭包参数。

## 2. 测试与构建

- [x] 2.1 更新 `backend/agent-core/test/*.test.cjs` 中 mock `axios.post` 到 `/api/skills/api` 的用例，在有 `userId` 的调用路径上断言存在 `X-User-Id`；无 `userId` 时不强制。
- [x] 2.2 运行 `backend/agent-core` 的 `npm run build` 与 `npm run test:tools`，全部通过。

## 3. 文档与自检

- [x] 3.1 若 `docs/agent-skill-execution-flows.md` 中关于审计/入站头的描述与实现不一致，**仅** 增补一句：`executeConfiguredApiSkill` 等入站**应** 带 `X-User-Id` 以支撑 `gateway_outbound_audit_logs.user_id`（可选，以偏差为准）。
- [x] 3.2 对照本 change 的 `specs/gateway-skill-outbound-audit/spec.md` 做实现自检，确认有 `userId` 时 DB 中 `user_id` 为真实用户、而非仅靠服务身份。
