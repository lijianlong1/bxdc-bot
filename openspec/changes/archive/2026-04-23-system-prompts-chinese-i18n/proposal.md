## Why

当前 agent-core 的系统提示词（System Prompts）全部使用英文编写，包括技能生成策略、任务跟踪策略、确认 UI 策略等。这导致在对接中文大模型（如文心一言、通义千问、智谱 GLM 等）时存在以下问题：

1. **理解偏差**：中文模型对英文指令的理解可能不如英文模型准确，导致执行效果下降
2. **语境不匹配**：中文场景下的对话使用英文系统提示，造成语境割裂
3. **难以调优**：国内开发者难以直接修改和优化系统提示词

因此，需要将系统提示词中文化，并支持通过配置项灵活切换语言版本，以更好地适配中文大模型生态。

## What Changes

- **新增配置项**：添加 `AGENT_PROMPTS_LANGUAGE` 环境变量，支持 `zh`（中文）和 `en`（英文，默认）两种语言
- **中文化系统提示词**：将以下核心策略提示词翻译为中文版本：
  - `AGENT_SKILL_GENERATOR_POLICY`（技能生成策略）
  - `AGENT_TASK_TRACKING_POLICY`（任务跟踪策略）
  - `AGENT_CONFIRMATION_UI_POLICY`（确认 UI 策略）
  - `AGENT_EXTENDED_SKILL_ROUTING_POLICY`（扩展技能路由策略）
- **动态加载机制**：重构提示词加载逻辑，根据配置动态选择语言版本
- **代码重构**：将硬编码的提示词抽取到独立的 prompts 模块，便于维护和扩展
- **向后兼容**：英文版本保持默认，现有部署不受影响

## Capabilities

### New Capabilities
- `configurable-system-prompts`: 支持通过配置项动态切换系统提示词语言
- `chinese-prompts-i18n`: 提供完整的中文版系统提示词，适配中文大模型

### Modified Capabilities
- 无现有能力变更，本次为纯新增能力

## Impact

**受影响代码**：
- `src/controller/agent.controller.ts` - 策略提示词定义和注入逻辑
- `src/agent/tasks-state.ts` - 任务状态摘要生成逻辑
- 新增 `src/prompts/` 目录 - 存放多语言提示词定义
- `src/app.config.ts`（或新增配置模块）- 配置项定义

**API 变更**：无 API 变更，纯内部逻辑调整

**依赖变化**：无新增依赖

**配置变更**：
- 新增环境变量 `AGENT_PROMPTS_LANGUAGE`，可选值：`zh` | `en`
- 默认值：`en`（保持向后兼容）
