## 1. 数据库

- [ ] 1.1 在 `schema-mysql.sql` 中新增 `skill_text_prompts` 表定义（含 UNIQUE 索引）
- [ ] 1.2 创建 `SkillTextPrompt` 实体类（MyBatis-Plus）
- [ ] 1.3 创建 `SkillTextPromptMapper`（MyBatis-Plus BaseMapper + 按 fieldId 查询）
- [ ] 1.4 插入 9 条预设提示词数据（对应 9 个 field_id）

## 2. Gateway 提示词管理端点

- [ ] 2.1 新增 `GET /api/skills/text-prompts` — 返回所有提示词列表
- [ ] 2.2 新增 `GET /api/skills/text-prompts/{fieldId}` — 返回单个提示词
- [ ] 2.3 新增 `PUT /api/skills/text-prompts/{fieldId}` — 更新提示词（管理员用）
- [ ] 2.4 在 SecurityConfig 中开放 `GET /api/skills/text-prompts/**`（Agent Core 放通）

## 3. Agent Core 优化服务

- [ ] 3.1 创建 `backend/agent-core/src/features/optimize-text/` 目录结构（controller + service + prompts）
- [ ] 3.2 实现 `OptimizeTextService`：
  - 从 Gateway 获取 `fieldId` 对应的提示词
  - 组装 system prompt + user prompt（替换 `{{currentText}}` / `{{context}}`）
  - 调用 `ChatOpenAI.invoke()` 获取优化结果
  - 解析 LLM 返回的 JSON `{ optimizedText, explanation }`
- [ ] 3.3 实现 `POST /features/optimize-text` 端点
- [ ] 3.4 在 `app.module.ts` 注册 `OptimizeTextModule`
- [ ] 3.5 超时处理：LLM 调用设置 15 秒超时，超时返回错误提示

## 4. 提示词内容设计

- [ ] 4.1 `description`（技能介绍）：自然语言润色 + 补充缺失信息
- [ ] 4.2 `api_interface_description`（接口说明）：结构化描述参数
- [ ] 4.3 `api_parameter_contract`（参数格式契约）：JSON Schema 语法修正 + 补充字段描述
- [ ] 4.4 `api_async_poll`（异步轮询配置）：JSON 语法修正 + 补充缺失字段
- [ ] 4.5 `api_headers`（Headers JSON）：JSON 语法修正
- [ ] 4.6 `api_query`（Query JSON）：JSON 语法修正
- [ ] 4.7 `api_body`（Body JSON）：JSON 语法修正
- [ ] 4.8 `ssh_command`（执行命令）：Shell 语法检查 + 安全风险提示
- [ ] 4.9 `openclaw_prompt`（自主规划提示词）：Markdown 结构优化

## 5. 前端 UI

- [ ] 5.1 创建 `TextOptimizeModal.vue` 弹窗组件（原始文本 vs 优化文本对比 + 说明 + 确认/取消按钮）
- [ ] 5.2 在 `SkillManagementModal.vue` 的长文本输入框中集成"AI 优化"按钮：
  - 技能介绍（`description`）
  - 接口说明（`interfaceDescription`）
  - 参数格式契约（`parameterContractText`）
  - 异步轮询配置（`asyncPollText`）
  - Headers JSON（`headersText`）
  - Query JSON（`queryText`）
  - Body JSON（`bodyText`）
  - 执行命令（SSH `command`）
  - 提示词（OPENCLAW `systemPromptMarkdown`）
- [ ] 5.3 实现 Optimize API 调用（`POST /features/optimize-text`），含 loading 状态和错误处理
- [ ] 5.4 优化完成后展示对比弹窗，用户确认后替换对应输入框内容

## 6. 测试与验证

- [ ] 6.1 验证各 fieldId 的优化请求能正确返回优化结果
- [ ] 6.2 验证 JSON 字段（参数契约、异步配置等）优化后语法正确可解析
- [ ] 6.3 验证弹窗中确认替换后输入框内容更新
- [ ] 6.4 验证取消操作后输入框内容不变
- [ ] 6.5 验证 Gateway 提示词 CRUD 端点正常工作
