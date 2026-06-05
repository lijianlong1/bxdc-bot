## ADDED Requirements

### Requirement: 优化 Skill 字段的中文展示
系统在向前端或用户展示 Skill 的基础信息时，必须将 `Name` 和 `Description` 字段映射为更直观的中文名称。

#### Scenario: 获取 Skill 列表信息
- **WHEN** 用户或前端请求获取 Skill 的列表或基础信息
- **THEN** 系统返回的数据中，`Name` 字段的中文展示名称应为“名称”，`Description` 字段的中文展示名称应为“技能介绍”。

### Requirement: 延迟加载 Skill 的全量参数
在 `loadGatewayExtendedTools`（或类似初始加载场景）中，系统只能加载 Skill 的基础信息（如 `Name` 和 `Description`），以减少性能开销。

#### Scenario: 初始加载 Skill 列表
- **WHEN** 系统调用 `loadGatewayExtendedTools` 以加载可用的扩展工具
- **THEN** 系统仅获取每个 Skill 的 `Name` 和 `Description`，不加载其他复杂的参数定义。

#### Scenario: 确认调用 Skill 时加载全量参数
- **WHEN** 系统或用户确认要调用某个特定的 Skill
- **THEN** 系统根据该 Skill 的标识符（如 ID）获取并加载该 Skill 的所有其他参数，以供后续执行使用。