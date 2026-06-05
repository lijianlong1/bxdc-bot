## Why

当前 Agent Core 同时承担 **Skill 元数据拉取、参数归一化、JSON Schema 校验、HTTP 组装与调用 Skill Gateway** 等多层职责；内置能力与扩展能力在代码路径上分裂（`Java*Tool` 与 `loadGatewayExtendedTools`），演进成本高、重复逻辑多。目标是将 **内置业务逻辑集中在 Java（Skill Gateway）**、**扩展 Skill 仍按既有扩展表与 CRUD 演进**；Agent 对外仅 **thin**：按 Gateway 返回的描述与 schema 调用接口。系统级（Built-in）与扩展在 **数据与治理上分离**，避免混在同一张表与同一路管理 API。

## What Changes

- **Skill Gateway（Java）**
  - **系统 Built-in Skill** 存于 **独立数据表**（与现有用户/扩展 **`skills` 表分离**），由迁移或种子初始化；**系统级 Skill 的 CRUD（若对运维暴露）与扩展 Skill 的 CRUD MUST NOT 共用同一套 Service/Controller 路径**（可复用底层 Executor，但注册、权限、校验分离）。
  - 面向 Agent 提供 **聚合发现能力**：一次响应中合并 **built-in 元数据 + 扩展 Skill 元数据**（或分两次调用由 Agent 组装），但 **来源在数据模型上仍区分**。
  - **内置执行路径**：新增 **统一 execute 入口**（或 dedicated built-in execute），将原由 Node 内 `JavaApiTool`、`JavaComputeTool`、`JavaSshTool`（`ssh_executor`）等承担的出站逻辑 **迁入 Java**，与扩展 API Skill 在「参数经 Gateway 校验再出站」上 **语义对齐**，但 **路由与数据源按 built-in vs extension 分流**。
  - **扩展 Skill**：延续现有 `skills` 表与 `EXTENSION` 等类型；**扩展执行**仍以现有/调整后的 Gateway 路径为准，本变更不强制与内置共用同一张物理表。

- **Agent Core（Node）**
  - 新增 **配置项（环境变量或等价）**，仅用于切换 **内置类 Skill** 的调用方式：**原有**（硬编码 `JavaApiTool`、`JavaComputeTool`、`JavaSshTool` 等直连既有子路径）与 **新增**（从 Gateway 拉取 built-in 元数据并调用 Gateway 暴露的 built-in 执行 API）。扩展 Skill 的加载方式变更 **不在此开关语义内**（或需单独说明），避免一个开关混淆两层行为。
  - **阶段范围**：**不改变** 当前 **`skill_generator`** 的实现与挂载方式；优先迁移 **`api_caller`（`JavaApiTool`）、`compute`、`ssh_executor`（及与设计对齐的同类内置工具，如 `linux_script`、`server_lookup` 若纳入同一批次）**；待内置路径稳定后再考虑 generator 与其他工具。

- **契约**
  - **BREAKING 风险**：built-in 发现/execute API 为新增；通过 **Agent 内置切换参数** 控制灰度。
  - 前端若依赖 **tool 名称**，须保持 **`api_caller`/`compute`/`ssh_executor` 等** 在迁移后与迁移前一致或提供别名。

## Capabilities

### New Capabilities

- `unified-skill-platform`：定义 **系统 built-in 与扩展分表、CRUD 分流**、Gateway 执行路由、Agent **内置调用方式切换参数**，以及本阶段 **迁移范围（不含 skill_generator）**。

### Modified Capabilities

- `extended-skill-structured-tools`：扩展 Skill 仍以 **DynamicStructuredTool** 暴露；**执行主落点**迁至 Gateway 的路径 **仅与扩展表及扩展 execute 语义绑定**；与内置迁移 **正交**。
- `api-skill-invocation`：扩展 API Skill 的归一化与 HTTP 代理主实现 **SHALL** 位于 Skill Gateway；与 **built-in 分表** 不混读。

## Impact

- **代码**：`backend/agent-core`（新参数、条件挂载 built-in）；`backend/skill-gateway`（新表、独立 CRUD、execute/built-in 列表）；`.env.example` 文档更新。
- **数据**：**新表**（系统 built-in）+ 既有 **`skills`**（扩展）；迁移脚本分轨。
- **运维**：发布需 **Agent + Gateway 协调**；回滚可通过 **关闭内置新路径** 恢复旧 Node 直连。
- **文档**：`docs/agent-skill-execution-flows.md` 等更新 **分表与开关** 说明。
