## Why

当前 skill 架构把 `time`、`api`、`monitor` 都作为 `kind`，导致语义层级混淆：其中 `time` 和 `monitor` 本质上是预配置场景，而不是并列的基础连接类型。随着自动生成 skill 能力扩展，这种混淆会持续放大，增加生成器、校验器和维护者的认知成本。

## What Changes

- 将 `kind` 收敛为基础连接类型：`api` 与 `ssh`。
- 将“时间查询”“服务器状态检查”等现有 `time`、`monitor` 场景重构为 `api/ssh` 类型下的预配置 skill 模板（profile/preset）。
- 统一更新 skill 生成逻辑、后端校验规则和前端编辑/展示文案，确保新旧数据迁移期间行为一致。
- 为旧配置提供兼容与迁移策略，避免线上已有 skill 立即失效。  

## Capabilities

### New Capabilities
- `skill-kind-normalization`: 规范 skill 配置模型，区分基础 `kind` 与其下的预配置模板。

### Modified Capabilities
- `built-in-skill-generation`: 生成器产物从 `time/monitor` 并列 kind 迁移为 `api/ssh` kind + 对应预配置模板。
- `skill-hub-ui`: 技能管理界面改为展示“基础类型 + 预配置模板”，而非将 `time/monitor` 作为独立类型。

## Impact

- 影响模块：
  - `backend/skill-gateway`（配置校验、兼容转换、可能的数据迁移）
  - `backend/agent-core`（`JavaSkillGeneratorTool` 生成逻辑与运行分发）
  - `frontend` 技能管理与 built-in 列表展示
- 影响文档与规范：
  - `openspec/specs/built-in-skill-generation/spec.md`
  - `openspec/specs/skill-hub-ui/spec.md`
  - 新增 `openspec/specs/skill-kind-normalization/spec.md`
