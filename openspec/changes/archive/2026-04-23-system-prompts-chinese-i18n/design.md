## Context

当前 agent-core 的系统提示词分散在多个文件中：

- `src/controller/agent.controller.ts` 中定义了 4 个核心策略提示词常量（AGENT_SKILL_GENERATOR_POLICY 等）
- `src/agent/tasks-state.ts` 中定义了任务状态摘要生成逻辑
- 这些提示词全部使用英文硬编码，没有多语言支持机制

随着项目需要对接更多中文大模型（文心一言、通义千问等），硬编码的英文提示词成为阻碍。需要设计一个可配置的多语言提示词系统。

## Goals / Non-Goals

**Goals:**
- 支持通过环境变量 `AGENT_PROMPTS_LANGUAGE` 切换提示词语言（zh/en）
- 提供完整的中文版系统提示词，语义与英文版完全一致
- 将提示词从业务代码中抽离，便于维护和扩展
- 保持向后兼容，默认使用英文，现有部署不受影响

**Non-Goals:**
- 不支持动态语言切换（运行时不改变）
- 不覆盖 SKILL.md 技能文件的提示词（技能文件本身可自定义）
- 不实现完整的 i18n 框架（仅系统提示词层面）
- 不支持除中英文外的其他语言（预留扩展能力但不实现）

## Decisions

### 1. 提示词组织方式：独立模块 vs 配置文件

**选择**：在 `src/prompts/` 目录下按语言分文件存储，如 `src/prompts/en.ts` 和 `src/prompts/zh.ts`

**理由**：
- 配置文件（JSON/YAML）缺乏类型检查，容易出错
- 代码文件可以获得 TypeScript 的类型提示和 IDE 支持
- 复杂的提示词模板可能需要函数拼接，代码文件更灵活
- 与现有代码风格一致（agent-core 本身使用 TypeScript）

**替代方案**：JSON 配置文件
- 拒绝理由：需要额外的文件加载逻辑，无类型安全

### 2. 配置方式：环境变量 vs 配置文件 vs 运行时参数

**选择**：使用环境变量 `AGENT_PROMPTS_LANGUAGE`

**理由**：
- 与现有配置方式一致（如 `OPENAI_MODEL_NAME`、`JAVA_GATEWAY_URL` 等）
- 部署简单，无需修改代码即可切换语言
- 与容器化部署友好

**默认值**：`en`（保持向后兼容）

**有效值**：`zh` | `en`

### 3. 语言加载机制：运行时动态加载 vs 编译时确定

**选择**：编译时确定，启动时加载对应语言包

**理由**：
- 性能更好，无需运行时判断
- 代码更简单，减少条件分支
- 语言切换需要重启服务，符合预期

**实现方式**：
```typescript
// prompts/index.ts
const lang = (process.env.AGENT_PROMPTS_LANGUAGE || 'en').toLowerCase();
export const Prompts = lang === 'zh' ? zhPrompts : enPrompts;
```

### 4. 提示词结构：扁平对象 vs 嵌套命名空间

**选择**：扁平对象结构，按用途命名

**结构示例**：
```typescript
export interface SystemPrompts {
  // 策略提示词
  skillGeneratorPolicy: string;
  taskTrackingPolicy: string;
  confirmationUIPolicy: string;
  extendedSkillRoutingPolicy: string;
  
  // 动态生成提示词函数
  buildTasksSummary: (tasks: TasksStatusMap) => string;
  buildSkillContext: (skills: SkillInfo[]) => string;
  
  // 其他固定提示词
  emojiGeneratorSystem: string;
}
```

**理由**：
- 扁平结构调用简单：`Prompts.skillGeneratorPolicy`
- 命名本身带有命名空间语义（Policy、Summary、Context）
- 避免过深的嵌套路径

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 中英文版本语义不一致 | 建立术语表，关键术语统一翻译；QA 环节对比验证 |
| 中文大模型对中文提示词理解不如英文 | 提供 A/B 测试机制，允许用户根据实际效果选择语言 |
| 新增提示词时漏掉翻译 | 在 CI 中添加检查，确保 zh.ts 和 en.ts 键一致 |
| 现有代码迁移工作量大 | 小步快跑，分批次迁移，每次只处理一个提示词 |

## Migration Plan

**部署步骤**：
1. 创建 `src/prompts/` 目录和基础结构
2. 迁移第一个提示词（如 AGENT_CONFIRMATION_UI_POLICY）进行验证
3. 逐步迁移剩余提示词
4. 添加 `AGENT_PROMPTS_LANGUAGE` 环境变量支持
5. 更新 `.env.example` 文档

**回滚策略**：
- 不设置 `AGENT_PROMPTS_LANGUAGE` 时默认使用英文，等同于回滚
- 若中文版本有问题，可立即切换回英文

**验证清单**：
- [ ] 英文版本输出与迁移前完全一致
- [ ] 中文版本语义通顺，无歧义
- [ ] 环境变量切换正常工作
- [ ] 未设置环境变量时默认英文

## Open Questions

1. 是否需要支持混合模式（部分提示词中文、部分英文）？
   - 初步判断：不需要，增加复杂度，统一语言即可

2. 中文大模型的实际效果是否需要对比测试数据支撑？
   - 建议：可以先在小流量环境验证中文版本效果

3. 头像生成等固定提示词是否需要翻译？
   - 建议：本次仅翻译系统策略提示词，头像生成保持英文（不影响理解）
