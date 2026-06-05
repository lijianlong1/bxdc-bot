## Why

bxdc-bot 是一个 AI Agent 对话平台，让用户可以通过自然语言与智能助手交互，完成 API 调用、服务器操作、代码生成等任务。

当前项目缺乏一份从用户视角描述的需求文档，新开发人员难以快速理解平台的功能边界和核心能力。需要创建一份简明易懂的需求书，帮助团队对齐认知。

## What Changes

创建一份平台级需求文档，内容包括：

- **用户故事**：描述典型用户如何使用平台
- **功能边界**：明确平台能做什么、不能做什么
- **核心概念**：解释 Built-in Skill、Extension Skill、ReAct、记忆等关键术语
- **架构概览**：前端、agent-core、skill-gateway、mem0 之间的关系

## Capabilities

### New Capabilities

无（本文档为需求描述，不涉及新功能开发）

### Modified Capabilities

无

## Impact

- **文档**：新增 `openspec/changes/platform-requirements-doc/` 目录下的需求文档
- **受众**：新加入的开发人员、产品经理、运维人员
- **目标**：降低项目理解成本，统一团队对平台能力的认知
