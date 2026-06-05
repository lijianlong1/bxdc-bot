## 1. Agent Core — 工具与执行路径

- [ ] 1.1 从 `AgentFactory.createAgent` **移除** `JavaSshTool`；**保留** `JavaServerLookupTool`：`Zod` 与 HTTP 入参为 **`serverName`**；**输出** 与 Gateway `candidates` 对齐（**最多 5 条** `serverId` + `label`；**BREAKING**，旧 IP/用户/密码响应已弃用）。**方案 A**、字段 **`serverName` / `serverId`** 已在 `java-skills.ts` 与扩展技能 schema 落地。
- [ ] 1.2 更新 `loadGatewayExtendedTools` 中 **扩展「服务器命令」** 之执行：向 `POST .../linux-script` 传 **`serverId` + `command`**；若定稿为 **A（两次 tool）**则扩展技能之 tool 入参在调用前已由 Agent 解析出 `serverId`；若定稿为 **B（Gateway 单跳）** 则在 `executeServerResourceStatusSkill` 内转发 `serverName`/`serverId` 与 Java 协议对齐。移除「lookup IP 再 `POST /api/skills/ssh`」之旧路。
- [ ] 1.3 在 `buildGeneratedSkill`（`targetType === "ssh"`）中把 `executor` 设为 `linux_script_executor`；`interfaceDescription` 描述 **`serverName`→lookup→`serverId`→执行** 与 schema 字段名。
- [ ] 1.4 更新 `prompts/en.ts`、`zh.ts`：删除 **`ssh_executor`**；**写清** `server_lookup`（新语义）与 `linux_script_executor` 的先后顺序与字段。
- [ ] 1.5 更新 `java-skills` 与 loader/任务单测中工具与响应断言。

## 2. Skill Gateway（Java）

- [ ] 2.1 实现/改造 `GET/POST` **server-lookup**（或等义路由）：按当前用户ledger + `serverName` 返回 **候选 `serverId`**，不含敏感凭据；与旧版响应 **BREAKING** 时做版本或双字段弃用期（按排期）。
- [ ] 2.2 确认 **`POST /api/skills/linux-script`** 仅以 **`serverId` + `command`**（及鉴权头）在服务端解凭据与执行；补集成测（多候选、无匹配、非法 id）。
- [ ] 2.3 与产品确认对 **`POST /api/skills/ssh` 的 Agent 暴露**是否关闭；内部保留与否单独标注。

## 3. Frontend 与元数据

- [ ] 3.1 若 UI 或调试区展示 old lookup 的 IP/用户，改为展示 **候选 `serverId`** 等；`skillEditor` 默认 `executor: linux_script_executor`。
- [ ] 3.2 更新 `skillEditor.test.ts` 等。

## 4. 数据与 OpenSpec

- [ ] 4.1 扩展技能与生成器之 `configuration.executor` 迁到 `linux_script_executor`；存量的以 IP 为假设之说明从文档移出。
- [ ] 4.2 合并本 change 的 spec delta 时，**`server-lookup-skill`** 为 **MODIFIED**（非全删），与主 `openspec/specs` 合稿。

## 5. 回归

- [ ] 5.1 E2E：仅 **`serverName`** 时，先 **lookup** 得 **`serverId`**，再 **linux 脚本** 成功；响应中无密码。
- [ ] 5.2 多 `serverId` 候选时，Agent 能消歧或报歧义。
- [ ] 5.3 检查 OpenClaw `allowedTools`：移除 `ssh_executor`，**允许** `server_lookup` 与 `linux_script_executor`（以实际定稿名称为准）。
