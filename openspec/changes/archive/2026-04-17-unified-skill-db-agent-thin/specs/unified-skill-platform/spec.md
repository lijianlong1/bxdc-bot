# unified-skill-platform

## Purpose

定义 **系统 Built-in Skill 与扩展 Skill 在存储与治理上分离**、**Gateway 对两类数据分流 CRUD 与执行**、**Agent Core 通过专用参数切换内置 Skill 调用方式（原有硬编码工具 vs Gateway 新路径）** 的边界；本阶段 **不包含 skill_generator** 的改造，优先覆盖 **api_caller、compute、ssh_executor** 等内置能力的迁移。

## ADDED Requirements

### Requirement: 系统 Built-in 与扩展 Skill 分表存储

系统 SHALL 将 **平台系统级 Built-in Skill** 的定义存放在 **独立的数据表** 中；**用户/扩展 Skill** SHALL 继续存放在 **既有扩展 Skill 表**（如当前 `skills` 实体对应表）中。**MUST NOT** 将两类 Skill 混在同一业务表中仅靠 flag 区分作为本架构的长期形态（短期迁移期若有临时视图，须在 tasks 中标注拆除条件）。

#### Scenario: 扩展 Skill 仅存扩展表

- **WHEN** 用户或管理员创建 `EXTENSION` 类型 Skill
- **THEN** 持久化 MUST 仅发生在 **扩展 Skill 表** 及与之关联的扩展 CRUD 路径

#### Scenario: 系统内置仅存系统表

- **WHEN** 平台初始化或运维发布内置能力
- **THEN** 记录 MUST 写入 **系统 Built-in 表**，且 MUST NOT 要求与扩展行 **共享主键空间或同一 CRUD 接口**（查询聚合除外）

### Requirement: 系统级 Skill 的 CRUD 与扩展 Skill CRUD 分流

**系统 Built-in Skill** 的创建、更新、禁用、审计 **SHALL** 与 **扩展 Skill** 的 CRUD **使用分离的 API 与业务逻辑**（可复用底层 Executor，但 **入口、权限模型、校验 MUST 分离**）。普通用户扩展 Skill 的管理端 **MUST NOT** 误操作系统级行。

#### Scenario: 用户编辑扩展 Skill 不影响系统表

- **WHEN** 用户调用扩展 Skill 的更新 API
- **THEN** 系统 MUST NOT 修改 **系统 Built-in 表** 中的行

### Requirement: Agent 配置项控制内置 Skill 调用方式

Agent Core SHALL 提供 **独立配置项**（环境变量或等价机制），**仅**用于切换 **内置类 Skill**（如 `api_caller`、`compute`、`ssh_executor`）的调用方式：

- **legacy**：保持当前 **硬编码 Tool 类**（如 `JavaApiTool`、`JavaComputeTool`、`JavaSshTool`）直连 Gateway 既有细粒度端点（如 `/api/skills/api`、`/compute`）的行为；
- **gateway**：内置工具 **从 Gateway 拉取 built-in 元数据** 注册，执行 **仅通过** Gateway 为 built-in 暴露的 **统一或专用执行 API**，不在 Agent 内实现与具体内置类型绑定的出站组装逻辑。

**MUST NOT** 使用该配置项作为 **扩展 Skill** 加载方式的唯一开关（扩展路径若需开关，**须**单独配置）。

#### Scenario: legacy 模式

- **WHEN** 配置项设为 legacy（或默认未启用 gateway 模式）
- **THEN** Agent MUST 表现得与迁移前内置挂载方式一致（对已迁移工具集合）

#### Scenario: gateway 模式

- **WHEN** 配置项设为 gateway
- **THEN** 对已迁移的内置 Skill，Agent MUST 通过 Gateway built-in 发现与 execute 调用，且 MUST NOT 同时使用相同 tool 名称的重复硬编码注册

### Requirement: Gateway 对 Agent 暴露聚合发现能力

Skill Gateway SHALL 向 Agent 提供 **可合并的 Skill 元数据**（单次聚合响应或文档化的两次请求），使 Agent 能注册 **扩展 DynamicStructuredTool + 内置 DynamicStructuredTool**；响应中 **MUST** 携带可区分 **`source: built-in | extension`**（或等价字段），以便确认流与遥测。

#### Scenario: 区分来源

- **WHEN** Agent 请求 Skill 列表用于挂载工具
- **THEN** 每条记录 MUST 可被 Agent 判定来自 **系统表** 或 **扩展表**（或明确的分端点组合）

### Requirement: 本阶段迁移范围不含 skill_generator

在本变更的实施任务中，**`skill_generator`**（`JavaSkillGeneratorTool`）**SHALL NOT** 改为从系统 Built-in 表加载或改为依赖新的 built-in execute 路径；其行为 **SHALL** 维持变更前：**仍通过现有方式**（如直接 `POST /api/skills` 写扩展表）直至后续独立变更。

#### Scenario: generator 仍可用

- **WHEN** 配置项为 gateway 且内置列表来自系统表
- **THEN** **`skill_generator`** 仍 MUST 可按原逻辑创建扩展 Skill，且 **MUST NOT** 因本阶段改造而被移除或破坏

### Requirement: 阶段内优先迁移的内置 Skill

本阶段 **SHALL** 完成以下内置能力与 **gateway** 模式的接通（名称以产品与代码对齐为准）：**`api_caller`**（原 `JavaApiTool`）、**`compute`**（原 `JavaComputeTool`）、**`ssh_executor`**（原 `JavaSshTool`，受现有环境变量与确认策略约束）。**MAY** 顺延至后续批次：**linux_script**、**server_lookup** 等，须在 tasks 中列出。

#### Scenario: 首批迁移验证

- **WHEN** `AGENT_BUILTIN_SKILL_DISPATCH=gateway`（或等价）
- **THEN** 上述首批内置工具 **MUST** 无硬编码重复实现路径，且行为与 legacy 对照集一致（在容许的测试精度内）

### Requirement: 扩展 Skill 执行与内置迁移正交

扩展 Skill（`EXTENSION`）的 **execute 搬迁、parameterContract 校验落点** 可独立演进；**MUST NOT** 因 built-in 分表而强制扩展 Skill 并入系统表。Agent 側 **扩展** 工具仍 **MUST** 来自扩展表 discovery（除非另有 spec delta）。

#### Scenario: 扩展仍走扩展数据源

- **WHEN** Agent 加载扩展 Skill
- **THEN** 数据源 MUST 仍为 **扩展 Skill 表** 及既有 Gateway 列表语义
