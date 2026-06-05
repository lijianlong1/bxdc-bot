## 1. 基础设施搭建

- [x] 1.1 创建 `src/prompts/` 目录结构
- [x] 1.2 创建 `src/prompts/types.ts` 定义 Prompts 接口类型
- [x] 1.3 在 `.env.example` 中添加 `AGENT_PROMPTS_LANGUAGE` 配置项说明

## 2. 英文提示词提取

- [x] 2.1 创建 `src/prompts/en.ts`，从 `agent.controller.ts` 提取 `AGENT_SKILL_GENERATOR_POLICY`
- [x] 2.2 从 `agent.controller.ts` 提取 `AGENT_TASK_TRACKING_POLICY` 到 `en.ts`
- [x] 2.3 从 `agent.controller.ts` 提取 `AGENT_CONFIRMATION_UI_POLICY` 到 `en.ts`
- [x] 2.4 从 `agent.controller.ts` 提取 `AGENT_EXTENDED_SKILL_ROUTING_POLICY` 到 `en.ts`
- [x] 2.5 从 `tasks-state.ts` 提取 `buildTasksSummary` 函数到 `en.ts`
- [x] 2.6 验证 `en.ts` 中所有提示词与原文件内容完全一致

## 3. 中文提示词翻译

- [x] 3.1 创建 `src/prompts/zh.ts`，翻译 `skillGeneratorPolicy` 为中文
- [x] 3.2 翻译 `taskTrackingPolicy` 为中文，确保状态术语准确（pending→待处理、in_progress→进行中、completed→已完成、cancelled→已取消）
- [x] 3.3 翻译 `confirmationUIPolicy` 为中文
- [x] 3.4 翻译 `extendedSkillRoutingPolicy` 为中文
- [x] 3.5 实现中文版的 `buildTasksSummary` 函数，使用中文状态标签和提示文本
- [x] 3.6 检查中文术语一致性，确保相同概念使用统一翻译

## 4. 配置加载机制实现

- [x] 4.1 创建 `src/prompts/index.ts` 作为主入口
- [x] 4.2 实现环境变量 `AGENT_PROMPTS_LANGUAGE` 读取逻辑
- [x] 4.3 实现大小写不敏感的语言代码匹配（ZH/zh 都识别为中文）
- [x] 4.4 实现无效值回退到英文的逻辑，并添加警告日志
- [x] 4.5 导出统一的 `Prompts` 对象，根据配置动态选择语言包

## 5. 代码迁移与重构

- [x] 5.1 修改 `agent.controller.ts`，移除硬编码的英文提示词常量
- [x] 5.2 修改 `agent.controller.ts`，导入并使用 `Prompts` 模块
- [x] 5.3 修改 `tasks-state.ts`，移除硬编码的任务摘要生成逻辑
- [x] 5.4 修改 `tasks-state.ts`，使用 `Prompts.buildTasksSummary` 函数
- [x] 5.5 更新 `agent.controller.ts` 中的 `fullInstruction` 拼接逻辑，使用新的 prompts 接口

## 6. 测试与验证

- [x] 6.1 编写单元测试验证英文环境变量（未设置或设置为 en）下提示词正确加载
- [x] 6.2 编写单元测试验证中文环境变量（设置为 zh）下提示词正确加载
- [x] 6.3 编写单元测试验证无效环境变量值回退到英文的行为
- [x] 6.4 手动测试：启动服务，验证英文提示词注入到 LLM 请求中
- [x] 6.5 手动测试：设置 `AGENT_PROMPTS_LANGUAGE=zh`，验证中文提示词注入
- [x] 6.6 对比验证：中英文版本的语义一致性检查

## 7. 文档更新

- [ ] 7.1 更新 `CODEBASE_GUIDE.md`，添加 `src/prompts/` 模块说明
- [ ] 7.2 更新 `CODEBASE_GUIDE.md` 中的系统提示词章节，说明多语言支持
- [ ] 7.3 更新 `readme.md`（如有必要），添加语言配置说明
- [ ] 7.4 确保所有源文件头部注释包含语言配置相关的说明

## 8. 验收与交付

- [x] 8.1 运行全量测试套件，确保无回归问题
- [x] 8.2 代码审查：检查 TypeScript 类型定义完整性
- [x] 8.3 验证 `.env.example` 配置文档准确性
- [x] 8.4 创建简单的使用示例（中英文切换演示）
- [ ] 8.5 更新 OpenSpec 变更状态为已完成
