## Context

当前 Skill 编辑表单（`SkillManagementModal.vue`）包含以下长文本输入域：

| 文本框 | 对应字段 | 类型 | 所在表单区域 |
|--------|---------|------|------------|
| 技能介绍 | `description` | 自然语言 | 通用（所有 Skill 类型） |
| 接口说明 | `interfaceDescription` | 自然语言 | API Skill |
| 参数格式契约 (JSON) | `parameterContractText` | JSON | API Skill |
| 异步轮询配置 (JSON) | `asyncPollText` | JSON | API Skill（异步轮询启用时） |
| Headers (JSON) | `headersText` | JSON | API Skill |
| Query (JSON) | `queryText` | JSON | API Skill |
| Body (JSON) | `bodyText` | JSON | API Skill |
| 执行命令 | `command` (sshDraft) | Shell 命令 | SSH Skill |
| 提示词（自主规划） | `systemPromptMarkdown` (openClawDraft) | Markdown | OPENCLAW Skill |

用户填写这些字段时经常遇到 JSON 语法错误、自然语言描述不清晰、Shell 命令不安全等问题。

## Goals / Non-Goals

**Goals:**
- 为上述所有文本框提供"AI 优化"按钮
- 不同文本框使用不同的优化提示词（prompt），存储在数据库 `skill_text_prompts` 表中
- 优化结果在弹窗中展示对比，用户确认后替换原文本框内容
- 提示词与文本框通过 `field_id` 关联，便于后续编辑和维护
- Agent Core 提供统一的 `POST /features/optimize-text` 端点，Gateway 仅提供提示词查询

**Non-Goals:**
- 不支持实时自动优化（用户需手动点击按钮）
- 不支持批量优化多个字段
- 不覆盖短文本字段（名称、操作标识、请求方法等）
- 不覆盖 SSH 只读模式的布尔开关

## Decisions

### 1. 架构：Agent Core 直调 LLM，Gateway 仅存储提示词模板

**选择**：优化请求由 Agent Core 的 `POST /features/optimize-text` 处理，内部调用 LLM。Gateway 提供提示词模板的查询/更新接口。

**架构决策**：与现有的 `POST /features/avatar/greeting` 模式完全一致——前端调 Agent Core，Agent Core 调 LLM。Agent Core 不直接访问数据库，提示词通过 Gateway HTTP API 获取。

```
前端(skill编辑页)                 Agent Core(3000)               Gateway(18080)                LLM
  │                               │                              │                              │
  │ 点击 AI 优化按钮               │                              │                              │
  │ POST /features/optimize-text  │                              │                              │
  │ { fieldId, currentText,       │                              │                              │
  │   context, llmApiKey... }     │                              │                              │
  ├──────────────────────────────►│                              │                              │
  │                               │ GET /api/skills/text-prompts/│                              │
  │                               │   {fieldId}                  │                              │
  │                               ├─────────────────────────────►│                              │
  │                               │◄──── { prompt } ─────────────┤                              │
  │                               │                              │                              │
  │                               │ ChatOpenAI.invoke(prompt +   │                              │
  │                               │   currentText + context)     │                              │
  │                               ├──────────────────────────────────────────────────────────►│
  │                               │◄──── { optimizedText } ──────────────────────────────────┤
  │                               │                              │                              │
  │◄── { optimizedText,           │                              │                              │
  │      explanation }            │                              │                              │
  │                               │                              │                              │
  │ 弹窗展示对比                   │                              │                              │
  │ 用户确认 → 替换输入框内容       │                              │                              │
```

**理由**：
- LLM 调用链路已存在于 Agent Core（avatar/greeting 也走此模式）
- Gateway 只负责存储和提供提示词模板，不参与 LLM 调用
- 复用 `pickMergedLlm` 获取用户配置的 API Key/Base URL/Model

### 2. 提示词存储：数据库表 `skill_text_prompts`

**选择**：新建 `skill_text_prompts` 表，字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK | 自增 ID |
| `field_id` | VARCHAR(64) UNIQUE | 文本框标识符，如 `description`、`api_parameter_contract` |
| `field_label` | VARCHAR(128) | 中文标签，如"技能介绍" |
| `system_prompt` | TEXT | 系统提示词，告诉 LLM 如何优化 |
| `user_prompt_template` | TEXT | 用户提示词模板，`{{currentText}}` 和 `{{context}}` 为占位符 |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**预设 `field_id` 及默认提示词**：

| field_id | 中文标签 | 优化目标 |
|----------|---------|---------|
| `description` | 技能介绍 | 清晰描述功能、输入输出，补充缺失信息 |
| `api_interface_description` | 接口说明 | 结构化描述参数含义、枚举值、默认值、注意事项 |
| `api_parameter_contract` | 参数格式契约 | JSON Schema 语法修正 + 补充 description/type/enum |
| `api_async_poll` | 异步轮询配置 | JSON 语法修正 + 补充缺失的轮询字段 |
| `api_headers` | Headers (JSON) | JSON 语法修正 |
| `api_query` | Query (JSON) | JSON 语法修正 |
| `api_body` | Body (JSON) | JSON 语法修正 |
| `ssh_command` | 执行命令 | Shell 语法检查、安全风险提示、命令优化 |
| `openclaw_prompt` | 提示词（自主规划） | Markdown 结构优化、补充任务分解指引 |

### 3. 前端交互：文本框内按钮 + 对比弹窗

**选择**：每个长文本输入框右下角显示"AI 优化"按钮（图标 + 文字），点击后：

1. 前端调 `POST /features/optimize-text`，传 `fieldId`、`currentText`、`context`、LLM 配置（复用 avatar/greeting 的 `pickMergedLlm` 模式）
2. 显示 loading 状态（按钮变灰 + 旋转图标）
3. 拿到响应后弹出对比弹窗：
   - 左侧：原始文本（只读）
   - 右侧：优化后文本（可编辑）
   - 底部：AI 优化说明（explanation），告诉用户改了什么
4. 用户点击"确认替换"→ 优化后文本写入输入框 → 弹窗关闭
5. 用户点击"取消"→ 弹窗关闭，不修改

### 4. 端点设计

**`POST /features/optimize-text`**（Agent Core，port 3000）：

```typescript
// Request
{
  fieldId: string;        // 对应 skill_text_prompts.field_id
  currentText: string;    // 当前输入框内容
  context?: string;       // 额外上下文（如 Skill 名称、类型等）
  llmApiBase?: string;    // 用户自定义 LLM Base URL（透传给 pickMergedLlm）
  llmModelName?: string;  // 用户自定义 Model（同上）
  llmApiKey?: string;     // 用户自定义 API Key（同上）
}

// Response
{
  optimizedText: string;  // 优化后的文本
  explanation: string;    // 优化说明（改了什么、为什么）
}
```

### 5. Gateway 提示词管理端点

**`GET /api/skills/text-prompts/{fieldId}`**：返回单个提示词配置
**`PUT /api/skills/text-prompts/{fieldId}`**：更新提示词（管理员用，后续可加 UI）
**`GET /api/skills/text-prompts`**：返回所有提示词列表

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| LLM 返回的 JSON 仍然有语法错误 | prompt 中要求返回合法 JSON，Agent Core 侧 try JSON.parse 校验，失败时返回原始文本 + 报错说明 |
| LLM 调用超时影响用户体验 | 前端设置 15s 超时，超时后提示"优化超时，请稍后重试"，不阻塞编辑 |
| 提示词被误改导致优化质量下降 | `field_id` 为 UNIQUE，预设默认值不受影响；后续可加版本管理 |
| 用户依赖 AI 优化但不想用 | 按钮为非侵入式，不点击不影响正常编辑流程 |

## Migration Plan

**部署步骤**：
1. 执行 DDL 创建 `skill_text_prompts` 表，插入预设数据
2. 部署 Agent Core（新增 `optimize-text` feature 模块）
3. 部署 Gateway（新增提示词 CRUD 端点）
4. 部署前端（Skill 编辑表单增加 AI 优化按钮 + 弹窗）

**回滚策略**：
- 提示词表和端点无其他功能依赖，可直接保留或删除
- 前端按钮不点击不影响原有编辑流程
