## Why

用户在与 Agent 对话时经常需要执行数学运算或日期转换（如「把时间戳转成日期」「算 5 的阶乘」「100 开方」）。当前 Agent 仅有 SSH 与 API 调用能力，无法直接完成这些计算。增加计算 Skill 可让 Agent 在 Java 端统一、安全地执行运算，并避免依赖 LLM 自行推算可能带来的错误。

## What Changes

- 在 Java Skill Gateway 中新增 `/api/skills/compute` 端点，提供运算服务
- 支持运算类型：时间戳转 YYYY-MM-DD、加减乘除、阶乘、平方、开方
- 在 Agent Core 中新增 `JavaComputeTool`，封装对计算接口的调用
- 将计算 Skill 的描述加入 Agent 的 tool 列表，使 LLM 能正确识别并调用

## Capabilities

### New Capabilities

- `compute-skill`: 定义计算 Skill 的接口规范、运算类型、请求/响应格式及 Agent 侧 tool 描述

### Modified Capabilities

（无。compute 端点为新增，不修改现有 api-gateway 规范。）

## Impact

- **backend/skill-gateway**: 新增 `ComputeController` 或扩展 `SkillController`，实现 `/api/skills/compute`
- **backend/agent-core**: 新增 `JavaComputeTool`，在 `agent.ts` 中注册；可选在 `SkillManager` 或 agent 指令中补充计算能力描述
- **API**: 新增 `POST /api/skills/compute`，请求体包含 `operation` 与 `operands`
