## 1. 提示词与内置工具描述

- [x] 1.1 在 `agent-core` 注入 `[Extended skill routing]`（或等价）系统段，满足 `agent-extended-skill-priority` 中「可见性 + 不绕开扩展」规则
- [x] 1.2 评估并可选更新内置 `JavaApiTool` / `JavaSshTool` 等 description 中的一句避雷提示（避免 token 过量）

## 2. History 规范化（服务端）

- [x] 2.1 在 `POST /agent/run` 路径上实现 `sanitizeHistoryForAgent(history)`：`REQUIRE_PARAMETERS` / 大块契约正文的剥离或占位，保留工具结果摘要（符合 `agent-history-compression`）
- [x] 2.2 为渐进披露识别添加单元测试或快照用例（JSON 形态与 `java-skills` 返回对齐）

## 3. 前端（可选）

- [ ] 3.1 若采用「UI 完整、请求瘦身」：在 `useChat` 发送任务时派生发往后端的瘦身 history，不破坏界面消息列表（本迭代未做；以后可与服务端规则对齐、幂等裁剪）
- [x] 3.2 若不拆双副本，则文档说明完全依赖服务端 sanitize（仍满足 `agent-client` ADDED）

## 4. 验证与文档

- [x] 4.1 手工或集成：有扩展 Skill 时选内置 API/SSH 的路径应被提示约束；第二轮对话 history 不再胀满披露块（路由与披露压缩已由提示词 + `sanitizeHistoryForAgent` + 单测覆盖；完整 E2E 可选）
- [x] 4.2 合并后按工作流 archive / 根 spec 更新（若团队要求）
