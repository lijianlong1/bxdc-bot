## ADDED Requirements

### Requirement: AI 文本优化端点

系统 SHALL 提供 `POST /features/optimize-text` 端点（Agent Core），接收文本框标识符和当前内容，调用大模型进行智能优化后返回结果。

#### Scenario: 优化自然语言文本（技能介绍）

- **WHEN** 前端发送 `POST /features/optimize-text`，请求体 `{ fieldId: "description", currentText: "获取用户信息", context: "API Skill - 用户管理" }`
- **THEN** Agent Core SHALL 从 Gateway 获取 `fieldId=description` 对应的提示词模板
- **AND** Agent Core SHALL 将 `currentText` 和 `context` 填入模板，调用 LLM 生成优化结果
- **AND** 系统 SHALL 返回 `{ optimizedText: "通过用户ID获取用户的详细信息...", explanation: "补充了功能描述..." }`

#### Scenario: 优化 JSON 文本（参数格式契约）

- **WHEN** 前端发送 `POST /features/optimize-text`，请求体 `{ fieldId: "api_parameter_contract", currentText: "{type:object,properties:{page:type:number}}" }`
- **THEN** 系统 SHALL 检测到 JSON 语法错误并修正（补充引号、逗号）
- **AND** 系统 SHALL 返回语法正确的 JSON Schema
- **AND** `explanation` SHALL 说明修正了哪些语法问题

#### Scenario: 优化 JSON 文本（异步轮询配置）

- **WHEN** 前端发送 `fieldId: "api_async_poll"`，内容为不完整的异步轮询配置 JSON
- **THEN** 系统 SHALL 补充缺失的关键字段（如 `completionJsonPath`、`pollIntervalSeconds` 等）
- **AND** 系统 SHALL 在 `explanation` 中说明补充了哪些字段及原因

#### Scenario: LLM 返回的 JSON 无法解析

- **WHEN** LLM 返回的内容不是合法 JSON
- **THEN** 系统 SHALL 返回 `{ error: "AI 优化失败", hint: "大模型返回格式异常，请重试" }`
- **AND** 前端 SHALL 展示错误提示，不修改输入框内容

#### Scenario: LLM 调用超时

- **WHEN** LLM 调用超过 15 秒未返回
- **THEN** 系统 SHALL 返回 `{ error: "AI 优化超时", hint: "请稍后重试" }`
- **AND** 前端 SHALL 展示超时提示，不阻塞编辑流程

### Requirement: 提示词配置管理

系统 SHALL 在 `skill_text_prompts` 表中存储每个文本框对应的优化提示词，通过 `field_id` 唯一标识。

#### Scenario: 提示词表结构

- **WHEN** 数据库执行 DDL
- **THEN** `skill_text_prompts` 表 SHALL 包含以下字段：
  - `id`（BIGINT, PK, AUTO_INCREMENT）
  - `field_id`（VARCHAR(64), UNIQUE）
  - `field_label`（VARCHAR(128)，中文标签）
  - `system_prompt`（TEXT，系统提示词）
  - `user_prompt_template`（TEXT，含 `{{currentText}}` 和 `{{context}}` 占位符）
  - `created_at`（DATETIME）
  - `updated_at`（DATETIME）

#### Scenario: 查询单个提示词

- **WHEN** Agent Core 调用 `GET /api/skills/text-prompts/{fieldId}`
- **THEN** Gateway SHALL 返回匹配的提示词记录（含 `systemPrompt` 和 `userPromptTemplate`）
- **AND** 若 `fieldId` 不存在则返回 404

#### Scenario: 查询所有提示词

- **WHEN** 调用 `GET /api/skills/text-prompts`
- **THEN** Gateway SHALL 返回所有提示词列表

#### Scenario: 更新提示词

- **WHEN** 管理员调用 `PUT /api/skills/text-prompts/{fieldId}` 更新 `systemPrompt` 或 `userPromptTemplate`
- **THEN** Gateway SHALL 更新对应记录并返回成功
- **AND** 更新后的提示词 SHALL 在下次优化请求时立即生效

#### Scenario: 预设提示词初始化

- **WHEN** 数据库首次创建 `skill_text_prompts` 表
- **THEN** 系统 SHALL 插入 9 条预设数据，覆盖以下 `field_id`：
  - `description`（技能介绍）
  - `api_interface_description`（接口说明）
  - `api_parameter_contract`（参数格式契约）
  - `api_async_poll`（异步轮询配置）
  - `api_headers`（Headers JSON）
  - `api_query`（Query JSON）
  - `api_body`（Body JSON）
  - `ssh_command`（执行命令）
  - `openclaw_prompt`（自主规划提示词）

### Requirement: 前端 AI 优化交互

Skill 编辑表单中的每个长文本输入框 SHALL 包含"AI 优化"按钮，点击后触发优化流程。

#### Scenario: 点击 AI 优化按钮

- **WHEN** 用户在任意支持优化的文本框旁点击"AI 优化"按钮
- **THEN** 按钮 SHALL 进入 loading 状态（灰显 + 旋转图标）
- **AND** 前端 SHALL 发送 `POST /features/optimize-text` 请求，携带当前 `fieldId`、输入框内容、当前 Skill 名称等上下文
- **AND** 请求期间用户 SHALL NOT 能重复点击按钮

#### Scenario: 优化成功展示对比弹窗

- **WHEN** 优化请求成功返回
- **THEN** 前端 SHALL 弹出对比弹窗：
  - 左侧展示原始文本（只读）
  - 右侧展示优化后文本（可编辑）
  - 底部展示 AI 优化说明（explanation）
- **AND** 用户 SHALL 可编辑优化后的文本
- **AND** 提供"确认替换"和"取消"两个操作按钮

#### Scenario: 用户确认替换

- **WHEN** 用户在对比弹窗中点击"确认替换"
- **THEN** 优化后的文本 SHALL 写入对应的输入框
- **AND** 弹窗 SHALL 关闭

#### Scenario: 用户取消优化

- **WHEN** 用户在对比弹窗中点击"取消"
- **THEN** 输入框内容 SHALL NOT 被修改
- **AND** 弹窗 SHALL 关闭

#### Scenario: 优化请求失败

- **WHEN** 优化请求返回错误（超时、LLM 异常等）
- **THEN** 前端 SHALL 展示错误提示消息（非弹窗，toast 形式）
- **AND** 输入框内容 SHALL NOT 被修改
- **AND** 按钮 SHALL 恢复可点击状态

### Requirement: 支持的文本框列表

以下文本框 SHALL 支持 AI 优化功能：

#### Scenario: 通用字段

- **WHEN** 用户编辑"技能介绍"（`description`）文本框
- **THEN** 该文本框右下角 SHALL 显示"AI 优化"按钮
- **AND** `fieldId` 为 `description`

#### Scenario: API Skill 字段

- **WHEN** 用户编辑 API Skill 的以下文本框
- **THEN** 各文本框 SHALL 显示"AI 优化"按钮，`fieldId` 分别为：
  - 接口说明 → `api_interface_description`
  - 参数格式契约 (JSON) → `api_parameter_contract`
  - 异步轮询配置 (JSON) → `api_async_poll`（仅在启用异步轮询时）
  - Headers (JSON) → `api_headers`
  - Query (JSON) → `api_query`
  - Body (JSON) → `api_body`

#### Scenario: SSH Skill 字段

- **WHEN** 用户编辑 SSH Skill 的"执行命令"（`command`）文本框
- **THEN** 该文本框 SHALL 显示"AI 优化"按钮
- **AND** `fieldId` 为 `ssh_command`

#### Scenario: OPENCLAW Skill 字段

- **WHEN** 用户编辑 OPENCLAW Skill 的"提示词"（`systemPromptMarkdown`）文本框
- **THEN** 该文本框 SHALL 显示"AI 优化"按钮
- **AND** `fieldId` 为 `openclaw_prompt`
