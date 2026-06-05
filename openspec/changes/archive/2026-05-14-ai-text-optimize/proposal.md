## Why

用户在创建和编辑 Skill 时，需要填写大量文本内容（技能介绍、接口说明、参数契约 JSON、异步轮询配置 JSON、SSH 执行命令、自主规划提示词等）。当前用户经常面临以下问题：

1. **格式不正确**：JSON 字段语法错误（少逗号、引号不匹配），填写后保存失败或运行时校验报错
2. **内容质量参差**：技能介绍写得过于简略或冗长，LLM 调用时效果不佳
3. **缺乏引导**：用户不知道某个字段应该写什么、怎么写
4. **反复试错**：配置错误 → 调用失败 → 修改 → 再失败，体验差

利用大模型能力对文本框内容进行智能优化和格式校验，能显著提升 Skill 创建/编辑的成功率和质量。

## What Changes

- **新增 Agent Core `POST /features/optimize-text` 端点**：接收文本框 ID + 当前内容，调用大模型优化后返回结果
- **新增数据库表 `skill_text_prompts`**：存储每个文本框对应的 AI 优化提示词（prompt），通过 ID 关联
- **前端 Skill 编辑表单改造**：所有长文本输入框内增加"AI 优化"按钮，点击后弹出优化对比弹窗
- **Agent Core 新增 `optimize-text` Feature 模块**：封装 LLM 调用逻辑，支持不同文本框的不同提示词

## Capabilities

### New Capabilities
- `ai-text-optimize`: AI 辅助优化 Skill 编辑表单中的文本内容，含格式校验、内容润色、JSON 修正

### Modified Capabilities
- 无现有能力变更

## Impact

**受影响代码**：
- `backend/agent-core/src/features/optimize-text/` — **新增** controller + service + prompts
- `backend/agent-core/src/app.module.ts` — 注册新模块
- `backend/skill-gateway/src/main/resources/schema-mysql.sql` — 新增 `skill_text_prompts` 表
- `frontend/src/components/SkillManagementModal.vue` — 文本框增加 AI 优化按钮 + 对比弹窗
- `frontend/src/utils/skillEditor.ts` — 无需改动（优化结果通过前端直接替换字段值）

**API 变更**：
- 新增 `POST /features/optimize-text`（Agent Core） — 请求体含 `fieldId` + `currentText` + `context`，返回 `{ optimizedText, explanation }`
- 新增 `GET/PUT /api/skills/text-prompts`（Gateway） — 提示词 CRUD

**依赖变化**：无新增第三方依赖
