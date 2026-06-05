## 1. 调研与基线

- [x] 1.1 对照 `@langchain/langgraph@^1.2.0` 官方文档，写出最小 POC：`interrupt` + `Command`/`resume` + `thread_id` + checkpoint（内存即可）的调用序列
- [x] 1.2 审计当前路径：`agent.controller.ts` 流循环、`drainAsyncIterator`、`invokeExtendedSkillWithConfirmed`、`java-skills.ts` 中 `CONFIRMATION_REQUIRED` 与工具描述（含 SSH），列出与 spec 冲突点

## 2. 图与 checkpoint

- [x] 2.1 在 agent-core 引入（或配置）与部署一致的 **checkpoint store**；为每次用户对话/run 绑定稳定 **`thread_id`**（与任务 ID 或现有 `sessionId` 对齐，见 design 待定项）
- [x] 2.2 将「需确认的扩展 Skill」接入 **图内 interrupt**：在副作用前暂停，持久化状态；禁止仅依赖外层 Promise 无 checkpoint
- [x] 2.3 实现 `POST /agent/confirm`：**解析 thread** → **resume graph**（`Command` 或文档等价 API），移除或降级控制器内「drain + 二次 `invokeExtendedSkillWithConfirmed`」主路径

## 3. 提示词与工具

- [x] 3.1 调整动态工具 **description** 与任何「请用户打字确认」的返回片段，与 **UI 硬确认** 一致；必要时用占位 ToolMessage 或 middleware，避免 LLM 单通道念确认步骤（满足 `agent-confirmation-hil`）
- [x] 3.2 复核系统提示：明确危险操作由界面按钮确认，不要求用户自然语言回复作为唯一路径

## 4. 前端与会话契约

- [x] 4.1 确保 `useChat` / `api.confirmAction` 使用的 **`sessionId`/`thread_id` 与 run 一致**（与网关任务 `id` 映射可查）
- [x] 4.2 实现确认失败（404/网络）时的 **卡片状态与 thinking 收尾**，满足 `agent-client` 增量 spec

## 5. 验证

- [ ] 5.1 集成测试或 e2e：需确认 Skill → SSE `confirmation_request` → confirm → **同 thread** resume → assistant 有收尾输出、无「仅裸 JSON」停滞
- [ ] 5.2 回归：取消确认、超时/无 pending 错误提示、多轮对话 thread 不串线

## 6. 清理

- [x] 6.1 删除或标注废弃死代码路径（仅保留短期兼容层则加注释与开关期限）
- [ ] 6.2 更新归档：`openspec` 根 spec 在 apply 阶段按工作流合并（本 change 完成后执行 archive 流程）
