## Context

- **Target flow（本变更定稿）**  
  1. 用户以自然语言给出 **`serverName`**（或可从上下文唯一对应一台机）。  
  2. Agent **第一次 tool 调用** `server_lookup`：入参 **`serverName`**，得到 **最多 5 条** 按**相关度排序**的候选，每条含 **`serverId`**（及展示用元数据，不含凭据）。  
  3. **若仅 1 条候选**：Agent **默认**将该 `serverId` 作为目标，**无需**用户再点选（仍 MAY 在回复中说明选择了哪台）。**若 ≥2 条**：Agent **MUST** 向用户展示候选并请用户**确认/选择**后再继续。  
  4. Agent **第二次 tool 调用** `linux_script_executor`（或扩展 CONFIG 技能）：入参 **`serverId`** + 技能/对话中的 **`command`**。  
  5. Gateway `POST .../linux-script` 仅接收 **`serverId` + `command`**，在服务端解凭据并执行。

- **Current（改造前简况）**：`server_lookup` 常返回 `ip`、用户、密码等；`executeServerResourceStatusSkill` 可能走 `server-lookup` + `/api/skills/ssh`；`JavaSshTool` 在部分会话可用。

- **Stakeholders**：Agent/前端/安全/维护 Gateway 与台账服务的开发者。

## Goals / Non-Goals

**Goals:**

- 规范上固定 **方案 A：两次模型 tool 调用**（先 `server_lookup` 后 `linux_script` / 扩展执行），**不** 在单工具调用内由 Gateway 隐式内联两阶段。  
- **Lookup** 返回 **最多 5 个** 最相关候选项，字段 **`serverId` + 展示字段**；**不** 向 LLM 返回密码、私钥或完整 SSH 连接串。  
- 对外、对 Zod、对 HTTP 查询参数**统一**使用 **`serverName`（查机器）** 与 **`serverId`（执行脚本）** 命名（见下「字段统一」）。  
- **删除** `ssh_executor` 工具。  
- **技能生成** 与扩展技能之 **interface 描述 + Zod** 与上述字段名一致。

**Non-Goals:**

- 不规定台账管理 UI 的增删改（除非为展示 `serverId` 所必需）。  
- 不规定多机批跑、交互式 shell。

## Decisions

1. **方案 A（已定稿）**  
   - **MUST** 为两次 tool：`server_lookup` → 唯一确定 `serverId` 后 → `linux_script_executor` 或等义扩展执行。**MUST NOT** 以「单次 tool 在 Gateway 内先查再跑」作为唯一路径（除非未来单独开变更）。

2. **Lookup 候选项条数与消歧**  
   - 后端对给定 **`serverName`** 返回 **按相关度排序的 Top 5** 候选。  
   - **恰好 1 个候选**：Agent **默认**采用该 `serverId`，**无需**用户点选。  
   - **≥2 个候选**：Agent **MUST** 请用户**确认**选用哪一个 `serverId` 后再调用执行类工具。  
   - 相关度算法 **SHALL** 可测试（例如：精确名 > 前缀 > 子串，同分按稳定次序）；实现细节在代码与 `tasks.md` 中落地。

3. **Lookup 返回形态**  
   - 成功响应 **SHALL** 含 **`candidates`** 数组（长度 0–5），元素至少含 **`serverId`**，**MAY** 含 `label` 等。  
   - **MUST NOT** 将 **`password`、私钥、完整可登录连接串** 作为成功体主内容返回给 LLM。  
   - 可选：附带 **`count`** 或 **`needsUserConfirmation: true` when count>1** 以减轻模型推断错误。

4. **字段名统一（Zod + API）**  
   - `server_lookup` 工具与对应 HTTP：查询参数 **`serverName`**（为兼容可短暂支持旧的 `name` 别名，**deprecated**）。  
   - `linux_script_executor` 与 `POST /linux-script` 请求体：字段名 **`serverId`**、**`command`**（已存在之 `serverId` 保持）。  
   - **扩展技能** `server-resource-status` 之 DynamicStructuredTool schema：**MUST** 使用 **`serverId`**（**不再** 使用 `name` 指代选机；与「lookup 得 id 再执行」一致）。`buildGeneratedSkill` 中 `interfaceDescription` 等 **MUST** 与上述一致。  
   - **agent-core** 中 `serverLookupToolInputSchema`、`linuxScriptToolInputSchema`、`extendedSshSkillToolSchema`（将更名为语义清晰之 schema，可保留变量名）**MUST** 与上同步；`parseSshSkillPayload` **MAY** 仍接受旧键 **`name` 仅作迁移期回退**。

5. **移除** `JavaSshTool`；**保留** `JavaServerLookupTool` 并更新描述、Zod 与对 Gateway 新响应的解析/透传。

6. **serverId 与配置**：Linux 脚本执行所用 `serverId` 仍由 `skill.linux-script.servers.<serverId>.*` 解析；**若** 台账中 **机器别名** 与 **配置键** 在部署上约定为同一字符串，则 lookup 返回的 `serverId` 即该键（否则需后续在台账增加 `linuxServerId` 字段，本变更可在 `Risks` 中保留）。

7. **OpenClaw `allowedTools`**：允 `server_lookup`、`linux_script_executor`；禁 `ssh_executor`。

## Risks / Trade-offs

- **[风险]** 两跳 tool 增加时延与失败面 → 接受为方案 A 的显式成本。  
- **[风险]** 台帐 `name` 与 `linux-script` 配置 `serverId` 不一致导致执行 404 → **缓解**：部署文档约定一致，或后续表字段映射。  
- **权衡**：不返回凭据给模型，排障依赖后台或受控 API。

## Migration Plan

1. **Gateway**：`server-lookup` 新响应 schema + `serverName` 参数 + Top5 搜索；老客户端依 `name` 与旧 body 的 **BREAKING** 见发布说明。  
2. **agent-core**：Zod 与两阶段调用；`executeServerResourceStatusSkill` 调 **`linux-script`**，仅 `serverId`+`command`。  
3. **数据**：生成器与存量技能中说明字段由 `name`→`serverId` 的，跑迁移或兼容层。  
4. **回滚**：回退各服务版本与配置。

## Open Questions

*（本变更迭代的可交付范围内已全部关闭；若需台账「独立 linuxServerId 列」再单独立项。）*
