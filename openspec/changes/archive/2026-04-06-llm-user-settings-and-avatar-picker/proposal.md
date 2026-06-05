## Why

当前大模型连接参数（`OPENAI_API_BASE`、`OPENAI_MODEL_NAME`、`OPENAI_API_KEY`）仅能通过部署环境配置，终端用户无法自助切换供应商或模型；同时注册流程依赖 LLM 静默生成 emoji 头像，增加成本与不可控性。需要把头像改为用户可选或显式触发生成，并把 LLM 连接信息改为登录用户可在页面配置、服务端安全存储，以便无需改服务器环境即可切换模型。

## What Changes

- 取消「注册时自动调用 LLM 生成头像」的默认路径；改为用户从 emoji 选择器中选择头像，或点击「自动生成」按钮时再调用 LLM（失败则回退默认 emoji）。
- 为已登录用户提供「大模型连接」配置：兼容 OpenAI 的 API base URL、模型名称、API Key；配置保存在服务端，按用户隔离；`agent-core` 执行任务时优先使用该配置，未配置时回退环境变量默认值。
- API Key 在读取接口中不得明文重复暴露（仅支持写入与掩码展示或空占位）。
- 涉及 `skill-gateway`（用户设置持久化与 REST）、`agent-core`（按用户解析 LLM 配置并注入 `AgentFactory`）、前端（设置表单与注册/资料头像 UI）。

## Capabilities

### New Capabilities

- `user-llm-settings`: 定义每用户 LLM 连接参数（base URL、model、API Key）的存储、鉴权、掩码与在 Agent 执行路径中的解析优先级（相对环境变量默认值）。

### Modified Capabilities

- `ai-avatar-generator`: 从「必须由 LLM 根据昵称生成」改为「手动选择为主、可选按钮触发生成」，并明确无静默自动 LLM 调用。
- `user-profile`: 注册/资料中的头像行为与「仅 LLM 生成」脱钩，改为与 emoji 选择或显式生成一致。
- `api-gateway`: 增加用户 LLM 设置相关的 REST 契约（及与 `agent-core` 协同的任务上下文），使前端可保存设置且对话任务使用用户级配置。
- `agent-client`: 增加设置界面与调用用户 LLM 设置 API 的行为；注册/个人资料流与新的头像交互一致。

## Impact

- **backend/skill-gateway**：用户实体或独立表扩展、加密或安全存储 API Key、新 REST 端点；任务创建或上下文需携带 `userId` 供下游已有逻辑使用（若已存在则复用）。
- **backend/agent-core**：`AgentFactory` 与记忆侧等读取 `OPENAI_*` 的路径需支持「每用户覆盖」；可选扩展欢迎语/头像生成接口使用用户配置。
- **frontend**：注册页、用户资料、新增「大模型设置」页面或抽屉；API 客户端与类型。
- **部署文档**：说明环境变量仍为全局默认，用户设置可覆盖；运维需知密钥现由用户维度管理时的备份与合规注意点。
