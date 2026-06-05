## Context

当前实现中，Agent Core 通过 **`JAVA_GATEWAY_URL`** 访问 Skill Gateway：内置能力使用 **`JavaApiTool`、`JavaComputeTool`、`JavaSshTool`** 等；扩展能力通过 **`loadGatewayExtendedTools`** 拉取 `EXTENSION` 类型 Skill，并在 Node 侧 **`executeConfiguredApiSkill`** 内组装请求。目标改为：**系统 built-in 元数据与逻辑在 Java 与独立表中闭环**；**扩展 Skill** 仍在原扩展域演进；Agent 用 **专用参数** 切换内置 **旧/新** 调用方式；**本阶段不迁移 skill_generator**，优先 **`api_caller`、`compute`、`ssh_executor` 等**。

## Goals / Non-Goals

**Goals:**

- **物理分表**：系统 built-in Skill **不得**与扩展 Skill 落在同一张业务表；治理与 CRUD **分流**。
- **Gateway**：为 built-in 提供 **发现 + execute**（及可选 **运维向 CRUD**），与 **`skills` 扩展 CRUD** 分离。
- **Agent**：通过 **单一、语义明确的参数** 切换 **仅内置能力** 的旧路径 vs Gateway 新路径；扩展 Skill 行为由既有/并行设计约束，**不与此开关混写**。

**Non-Goals（本阶段）：**

- **不改动** **`skill_generator`** 的工具类、参数 schema 及写扩展表的调用链（可继续 `POST /api/skills`）。
- **不要求** 在本迭代内完成 **全部** 内置工具（如 `linux_script`、`server_lookup`）迁移，但 tasks 中可列为跟随项；**必选首批**：**api_caller、compute、ssh_executor**（名称以代码为准：`JavaApiTool`→`api_caller` 等）。
- 本地 **SkillManager 文件系统工具** 仍可按原样保留。

## Decisions

1. **系统 built-in 与扩展分表**  
   - **决策**：新增 **独立表**（命名实现待定，如 `system_skills` / `builtin_skills`），仅存平台内置定义；现有 **`skills` 表** 继续承载 **用户/扩展** Skill。**MUST NOT** 为「统一目录」而把两类写入同一表混用 CRUD。

2. **CRUD 分流**  
   - **决策**：扩展 Skill 仍走 **`SkillService` + `POST/PUT/DELETE /api/skills`**（及权限模型）；系统 built-in 的创建/更新/禁用 **走独立 API 与 Service**（仅运维或系统角色），**禁止**与普通用户扩展 **共用同一套「改 configuration 即生效」的 UI 假设**（除非显式标注为平台管理端）。

3. **面向 Agent 的发现**  
   - **决策**：Gateway 提供 **聚合列表**（或 `GET` built-in + `GET` extension 两段），返回 **统一 DTO 形状** 供 Agent 注册工具；DTO 内 **必须能区分** `source: built-in | extension`，便于确认流与 telemetry。

4. **内置 execute**  
   - **决策**：**`POST .../system-skills/execute`**（路径占位）或 **`POST .../execute` + body 含 `target: system`**；路由至 **Java** 内既有 `ApiProxyService`、`compute`、SSH 执行器等。**扩展 execute** 可继续沿用将落地的 **`POST .../skills/execute`（extension）** 或与现网兼容 path；**两套入口在实现上分离**，避免一个 handler 内无法分辨数据来源。

5. **Agent 切换参数（仅内置）**  
   - **决策**：在 **agent-core** 新增环境变量，例如 **`AGENT_BUILTIN_SKILL_DISPATCH`**：`legacy` | `gateway`（命名实现可微调，须写入 `.env.example`）。  
   - **`legacy`**：当前行为——`AgentFactory` 挂载 **`JavaApiTool`、`JavaComputeTool`、`JavaSshTool`**（等已迁移范围内的类）如现网。  
   - **`gateway`**：上述内置工具 **不再** 以硬编码类挂载，改为从 Gateway **拉取 built-in 列表** 并 **仅通过 Gateway built-in execute** 调用。  
   - **扩展 Skill**：默认仍 **`loadGatewayExtendedTools`**；若需单独开关，**不得**复用本变量，避免语义耦合。

6. **阶段范围**  
   - **决策**：**先** 迁移 **`api_caller`、`compute`、`ssh_executor`**（及文档对齐）；**`skill_generator` 原样保留**；`linux_script`、`server_lookup` 等为 **后续批次** 或同 PR 若容量允许。

## Risks / Trade-offs

- **[Risk] 两套表 + 两套 execute 增加 Gateway 复杂度** → **缓解**：共享 **Executor 实现层**，仅在 **入口与实体** 分叉。  
- **[Risk] 聚合列表与权限** → **缓解**：列表 API **按 Agent Token + User-Id** 过滤 extension；built-in **仅平台允许的全集或按租户策略**（若未来有）。  
- **[Trade-off] Agent 环境变量增多** → 文档与默认值明确 **`legacy` 为安全默认** 直至联调通过。

## Migration Plan

1. Gateway：新表 + 种子行 + **built-in-only** 发现与 execute；扩展表与 API **行为不变**（除非 delta spec 另有要求）。  
2. Agent：实现 **`AGENT_BUILTIN_SKILL_DISPATCH`**，默认 **`legacy`**。  
3. 逐个将 **api_caller / compute / ssh_executor** 在 **`gateway`** 模式下走新路径并测通。  
4. 预发将 **`gateway`** 设为默认前做全量回归。  
5. **Rollback**：`AGENT_BUILTIN_SKILL_DISPATCH=legacy`；Gateway 新表可保留。

## Open Questions

- **`openapi`** 定义是否与本变更同一迭代对外发布（供非 Node 客户端）。  
- **Built-in 表** 的最终表名与 **migration** 工具（Flyway 版本号）。  
- **`OPENCLAW`/template** 是否进入本轮 built-in execute（默认 **否**，与 Non-Goals 一致）。  
- **扩展 Skill** 的 execute 是否与本迭代 **合并** 至 Gateway（与 `executeConfiguredApiSkill` 搬迁）还是 **第二迭代**，需在 spec/tasks 中保持与 proposal 一致。
