## MODIFIED Requirements

### Requirement: 扩展 Skill 优先于同类内置工具

当当前会话已从 SkillGateway 加载了与用户需求语义匹配、且 **`enabled=true`、类型为 EXTENSION** 的扩展 Skill 工具时，Agent SHALL **优先**通过该扩展 Skill 工具完成相应能力；SHALL NOT 在同一用户意图下优先选用并行的 **built-in** 工具来**替代**该扩展 Skill，除非：(a) 用户明确要求使用底层/内置工具；(b) 扩展 Skill 明显不匹配该请求；(c) 扩展 Skill 报错且内置工具为唯一可行回退（回退行为 SHALL 在日志或结果中可区分）。

**列举（非穷举，且随 `createAgent` 实际注册变化）**：同类内置可能包含 **`server_lookup`（`serverName` → 候选 `serverId`）**、**`linux_script_executor`（`serverId` + `command`）**、**`compute`**、**`api_caller`** 等。**MUST NOT** 使用已移除之 **`ssh_executor`** 来替代「在服务器上跑脚本」的扩展技能。

#### Scenario: 存在 API 类扩展 Skill 时不绕开
- **WHEN** 用户请求某类能力（例如调用特定外部 HTTP 能力）
- **AND** 当前工具列表中已注册名称与描述匹配的扩展 Skill
- **THEN** Agent SHALL 调用该扩展 Skill 工具
- **AND** SHALL NOT 仅为走捷径而改用**无关**之内置能力替代（除非 (a)–(c) 成立）

#### Scenario: 用户显式要求底层工具
- **WHEN** 用户明确要求使用指定内置工具且该工具仍然存在
- **THEN** Agent MAY 使用所述内置工具
- **AND** 不要求扩展 Skill 优先

#### Scenario: 服务器名与两阶段工具不视为「绕开」
- **WHEN** 需执行扩展「服务器命令」类技能，且须先自 **`serverName` 得 `serverId`**
- **THEN** 使用内置 **`server_lookup` 再 `linux_script_executor`** 之流程 SHALL **不** 被理解为本条禁止之「用内置替代扩展技能」
- **AND** 若已存在**同一意图**的匹配扩展技能，**仍**优先调用该扩展技能工具，除非该技能不覆盖「选机+执行」之整体意图

## ADDED Requirements

### Requirement: 系统提示中的工具与路由
Agent Core SHALL 在注入的策略文本中：(**1**) 不宣称 **`ssh_executor`** 为可用；(**2**) 说明**远程执行**依赖 **`serverName` → `server_lookup`（得 `serverId`）→ `linux_script_executor` / 扩展技能** 之关系；(**3**) 所列名称 SHALL 与 `createAgent` 实际挂载之工具名一致（含新语义之 **`server_lookup`**）。

#### Scenario: 策略与已挂载工具一致
- **WHEN** 本变更在目标部署上生效
- **THEN** 系统提示中 SHALL NOT 引导使用 `ssh_executor`
- **AND** 若 `server_lookup` 已注册，可引导在仅知 `serverName` 时先解析 `serverId`
- **AND** 未在工具列表中的名字不得被宣称为可用

### Requirement: 系统提示中的路由规则可见性
Agent Core SHALL 在注入的策略文本中包含**清晰可读** 的「扩展 Skill 优先」规则，且与 SkillGateway 已加载的扩展集合一致，不因未加载的 Skill 而虚构工具名。

#### Scenario: 与 GET /api/skills 注册一致
- **WHEN** `GET /api/skills` 已为当前用户注册若干 EXTENSION 工具
- **THEN** 提示中列出的能力约束与该集合一致
- **AND** 未加载的扩展名不得被宣称为可用
