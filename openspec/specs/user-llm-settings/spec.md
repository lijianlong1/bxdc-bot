# user-llm-settings

## Purpose

定义登录用户级 OpenAI 兼容 LLM 连接参数（API base URL、模型名、API Key）的持久化、鉴权、掩码展示，以及在 Agent 执行与可选附属能力中的解析优先级。

## Requirements

### Requirement: 用户级 LLM 连接参数持久化

系统 MUST 为每个登录用户持久化以下字段：兼容 OpenAI 的 API base URL、模型名称、API Key；未设置的字段视为「使用系统默认值」而非空字符串强制覆盖。

#### Scenario: 首次保存完整配置

- **WHEN** 已登录用户提交有效的 base URL、模型名与 API Key
- **THEN** 系统将配置与该用户账户绑定并持久化
- **AND** 后续同用户 Agent 任务优先使用此配置

#### Scenario: 部分字段更新

- **WHEN** 用户仅更新模型名或 base URL 而未重新提交 API Key
- **THEN** 系统保留已存储的 API Key
- **AND** 仅更新提交的字段

### Requirement: API Key 读取与掩码

系统 MUST NOT 在面向用户的读取接口中返回明文 API Key；允许返回掩码字符串或仅返回「已配置」状态。

#### Scenario: 获取设置

- **WHEN** 客户端请求当前用户的 LLM 设置
- **THEN** 响应中不包含完整 API Key 明文
- **AND** 包含足够信息供 UI 展示「已配置」状态

### Requirement: Agent 执行路径的配置优先级

系统 MUST 在运行 Agent 任务时按以下优先级解析 LLM 连接参数：对已关联 `userId` 的任务，**必须先加载该用户持久化配置再合并**；用户已保存的非空字段覆盖对应环境变量；用户未设置的字段回退到进程环境变量（`OPENAI_API_BASE`、`OPENAI_MODEL_NAME`、`OPENAI_API_KEY`）。合并后的参数 MUST 实际用于发起 LLM 请求，使用户在页面保存后能稳定访问 LLM。

#### Scenario: 用户已配置全部字段

- **WHEN** 用户已为三项均提供非空值
- **THEN** Agent 调用使用该 base URL、模型名与 Key
- **AND** 不采用环境变量中的对应项

#### Scenario: 用户仅配置部分字段

- **WHEN** 用户仅配置了模型名
- **THEN** Agent 使用用户模型名
- **AND** base URL 与 Key 仍使用环境变量（若存在）

#### Scenario: 已登录且存在用户配置行

- **WHEN** 任务上下文包含 `userId` 且该用户在库中已有 LLM 设置记录
- **THEN** 系统在合并前读取该记录
- **AND** 合并后的参数用于本次 Agent 调用

### Requirement: 鉴权与隔离

用户 LLM 设置的读写接口 MUST 仅允许资源所有者（当前登录用户）访问；系统 MUST NOT 返回其他用户的配置。

#### Scenario: 越权访问被拒绝

- **WHEN** 请求尝试读取或修改不属于当前会话用户的 LLM 设置
- **THEN** 系统拒绝请求并返回错误
