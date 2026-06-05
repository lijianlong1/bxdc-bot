## Why

当前系统已经具备通过 built-in skill 自动生成 API 类型 skill 的基础能力，但这条链路既没有在 Skill Hub 中清晰暴露，也无法覆盖 SSH 预配置 skill 和自主规划 skill。随着 skill 类型已经扩展到 `CONFIG` / `OPENCLAW` 两类，生成能力和列表展示都需要同步升级，否则用户仍然难以发现和复用这类内置生成工具。

## What Changes

- 扩展现有 built-in skill 生成能力，使其除 API 预配置 skill 外，还支持生成预配置 SSH skill 和自主规划 skill。
- 为 built-in skill 生成器补充类型识别、配置归一化和保存后验证策略，确保不同生成类型都能映射到当前 SkillGateway / Agent Core 标准。
- 修改 Skill Hub 列表展示要求，让相关 built-in skill 生成器能够在技能列表中直接可见，而不是只保留当前固定的少量 built-in 项。
- 为不同生成类型的失败场景补充清晰反馈，例如描述不完整、缺少 SSH 连接信息、缺少自主规划提示词或工具白名单等。

## Capabilities

### New Capabilities
- `built-in-skill-generation`: 根据用户描述生成多种 skill 类型的 built-in 生成器能力，覆盖 API 预配置 skill、SSH 预配置 skill 和自主规划 skill，并支持保存后的验证/反馈。

### Modified Capabilities
- `skill-hub-ui`: 调整 Skill Hub 的 built-in skill 列表要求，使内置 skill 生成器在列表中可见并具备可理解的名称与说明。

## Impact

- `backend/agent-core`: 需要扩展 built-in skill 生成器，实现多类型 skill 配置生成、持久化串联与验证反馈。
- `backend/skill-gateway`: 继续复用现有 skill CRUD 与执行接口，并补足 SSH / OPENCLAW 生成结果所依赖的配置约束。
- `frontend`: Skill Hub 列表需要展示新增/扩展后的 built-in skill 生成器条目。
- `Skill configuration` 协议：需要明确 API、SSH、OPENCLAW 三类生成结果分别映射到哪些标准字段，确保生成后能被现有装载链路识别。
