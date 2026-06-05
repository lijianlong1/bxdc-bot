## Why

当前 Skill 管理窗口把预配置与自主规划两类 Skill 的主体内容都压缩成单个 JSON 文本框维护，用户必须了解完整配置协议才能新增或修改 Skill，容易输错字段，也不利于后续扩展类型校验与表单提示。随着双类型 Skill 已经落地，现在需要把维护体验升级为结构化字段编辑，并允许自主规划 Skill 直接以 Markdown 维护提示词内容。

## What Changes

- 将 Skill 管理窗口从“直接编辑整段 JSON”改为“按字段编辑 + 系统拼接配置”的维护模式。
- 为 `CONFIG` 类型 Skill 提供更细粒度的配置字段输入、校验与回填能力，减少用户手写 JSON。
- 为 `OPENCLAW` 类型 Skill 提供专门的编排字段维护能力，包括 `allowedTools`、串行编排配置与可直接输入 Markdown 的提示词编辑区。
- 调整前后端 Skill 管理接口契约，使前端可基于结构化字段读写两类 Skill，同时保持数据库中 `configuration` 的兼容存储格式。
- 保留对历史数据的兼容策略，旧 Skill 打开编辑时可被解析并映射为结构化表单；无法完整解析时给出明确提示。

## Capabilities

### New Capabilities
- `skill-management-editor`: 定义 Skill 管理窗口对两类数据库 Skill 的结构化编辑、校验、回填与保存行为。

### Modified Capabilities
- `skill-hub-ui`: Skill 管理入口与管理窗口需要支持按类型切换结构化维护视图，而非仅展示 JSON 文本。

## Impact

- 影响 `frontend` 中的 Skill 管理弹窗、表单状态、类型切换和保存逻辑。
- 影响 `backend/agent-core` 的 Skill 写代理接口，可能需要适配结构化请求体。
- 影响 `backend/skill-gateway` 的 Skill CRUD 校验与配置解析/回填逻辑。
- 影响数据库中两类 Skill 的 `configuration` 拼接与兼容读取策略。
- 需要补充两类 Skill 的编辑约定文档与联调验证。
