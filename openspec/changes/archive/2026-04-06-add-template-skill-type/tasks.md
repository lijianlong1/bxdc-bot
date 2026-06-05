## 1. SkillGateway：数据模型与校验

- [x] 1.1 在 Skill 创建/更新路径中接受 `configuration.kind === "template"`，并校验 `prompt` 为非空字符串
- [x] 1.2 将 canonical CONFIG `kind` 白名单更新为 `api`、`ssh`、`template`（与现有 normalization 逻辑对齐）
- [x] 1.3 为 template 校验与序列化补充或更新单元测试（Controller/Service 层）

## 2. agent-core：加载与工具执行

- [x] 2.1 在 `parseSkillConfig` / 类型守卫中识别 `kind: "template"`，仅要求 `prompt`
- [x] 2.2 注册 extended tool：调用时返回包含 `prompt` 的结构化结果（与设计一致），不发起 HTTP/SSH
- [x] 2.3 如需从列表补拉详情（与现有 API skill 模式一致），保证 `configuration` 完整

## 3. Skill 生成器

- [x] 3.1 在 `JavaSkillGeneratorTool`（及 agent 侧 TS 中 `buildGeneratedSkill` 等）增加 `targetType: "template"`（或等价枚举）
- [x] 3.2 提示词/Schema：描述如何生成仅含 `prompt` 的 CONFIG template，并与 `api`/`ssh`/`openclaw` 意图区分
- [x] 3.3 覆盖生成结果的测试或 fixture（至少一条 template 路径）

## 4. 前端 Skill 管理

- [x] 4.1 在 Skill 管理表单中增加「模板」类型：展示并编辑单一「提示词」字段，写入 `kind=template` + `prompt`
- [x] 4.2 列表或详情中正确展示 template Skill（名称、描述、类型）

## 5. 收尾

- [x] 5.1 （可选）在 `data.sql` 或文档中增加示例 template Skill
- [x] 5.2 本地联调：创建模板 Skill → Hub 可见 → Agent 工具调用返回预期
