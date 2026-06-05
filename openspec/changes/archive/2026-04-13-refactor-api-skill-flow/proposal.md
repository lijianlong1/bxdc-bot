## Why

当前 API Skill 的配置同时承担了路由说明、接口字段解释和运行时调用约束，导致表单难以维护、Agent 获取的信息粒度不合适，也缺少对模型输出参数的严格校验。随着 API Skill 数量增加，需要把“给人编辑的结构”“给模型理解的说明”“给运行时执行的契约”拆清楚，避免错误调用和低质量生成结果继续扩散。

## What Changes

- 重构 API Skill 表单字段结构，新增“接口说明”字段，集中描述入参说明、出参说明、核心字段含义、限制、字典值和默认值。
- 将接口说明字段改为渐进披露：常规 Skill 路由阶段仅暴露简要用途，只有 Agent 准备调用该 Skill 时才上报详细说明。
- 为 API Skill 增加严格的参数格式检查，只有模型输出满足 Skill 登记格式时才发起外部请求。
- 升级 API Skill 生成工具，使其产出的配置、说明和校验契约与新的表单结构保持一致。

## Capabilities

### New Capabilities
- `api-skill-runtime-contracts`: 为 API Skill 建立运行时参数契约、渐进披露说明注入和请求前校验流程。

### Modified Capabilities
- `skill-management-editor`: 调整 API Skill 结构化编辑表单，支持新的接口说明字段及相关配置组织方式。
- `api-skill-generation`: 调整 API Skill 生成功能，使生成结果包含新的接口说明与参数格式契约。
- `skill-discovery`: 调整动态加载给 Agent 的 Skill 描述信息，区分路由时简述与调用时详细说明。

## Impact

- 后端 `backend/agent-core` 中 API Skill 配置解析、动态工具注册、调用执行与生成工具逻辑。
- 前端 `frontend` 中 Skill 管理弹窗、结构化编辑器和配置序列化逻辑。
- OpenSpec 中与 API Skill 编辑、发现、生成和运行时调用相关的 specs。
