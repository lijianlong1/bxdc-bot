## Context

当前 `SkillManagementModal` 只有通用元字段和一个 `configuration` 文本框，保存前仅做“是否为合法 JSON”的校验。对于 `CONFIG` 类型 Skill，这要求维护者手写 `kind`、`operation`、`endpoint`、`query`、`command` 等协议字段；对于 `OPENCLAW` 类型 Skill，又需要手写 `systemPrompt`、`allowedTools`、`orchestration.mode` 等结构。虽然数据库最终仍以 `configuration` JSON 持久化，但编辑层缺少面向不同 Skill 协议的结构化模型。

这次改造主要触达 `frontend` 的 Skill 管理表单，同时会影响读写 Skill 时的配置解析与拼接策略。目标不是改变数据库持久化格式，而是在 UI 与保存链路中引入“编辑态 view-model”，让系统负责在结构化字段和最终 `configuration` JSON 之间转换，并让 `OPENCLAW` Skill 能直接输入多行 Markdown 提示词。

## Goals / Non-Goals

**Goals:**
- 为 `CONFIG` 与 `OPENCLAW` 两类数据库 Skill 提供分类型的结构化编辑表单。
- 将保存链路改为“编辑态字段 -> 系统序列化 -> 持久化 `configuration`”。
- 让已有 Skill 在打开编辑时可从现有 `configuration` 解析并回填到表单。
- 支持 `OPENCLAW` Skill 直接以 Markdown 维护提示词内容，并在保存时原样写入 `systemPrompt`。
- 对无法被完整解析的历史 Skill 给出可理解的错误或降级提示，避免静默覆盖。

**Non-Goals:**
- 不修改 `skills` 表结构，不新增专门的 prompt 字段或 editor 草稿表。
- 不把所有可能的任意 JSON 配置都做成无限制动态表单生成器。
- 不在本次变更中重做 Skill 执行协议；运行时仍以现有 `configuration` JSON 为准。
- 不引入富文本 Markdown 编辑器；首版仅要求支持纯文本/Markdown 多行输入与保存。

## Decisions

1. **保留持久化协议不变，新增前端编辑态模型**
   - **决定**：数据库与现有 CRUD 接口继续读写顶层 `Skill` + `configuration:string`，前端新增 `ConfigSkillDraft` / `OpenClawSkillDraft` 等编辑态模型，在提交时统一序列化为最终 JSON。
   - **理由**：这样能避免扩大后端接口改动面，同时保证 `agent-core` 和 `skill-gateway` 的运行时消费逻辑保持兼容。
   - **替代方案**：新增后端结构化字段接口。这样前端更轻，但会把编辑协议暴露成正式 API，并增加跨服务联调复杂度。

2. **`CONFIG` 类型采用“按 kind 分段表单”而不是原始 JSON**
   - **决定**：`CONFIG` Skill 先要求用户选择 `kind`，再按已支持的协议展示对应字段集合，例如 `time`、`api`、`monitor` 等。
   - **理由**：当前数据库中的 `CONFIG` Skill 已呈现稳定的协议分支，按 `kind` 分段最容易做到清晰表单、字段校验和配置回填。
   - **替代方案**：做通用 JSON Schema 驱动表单。扩展性更强，但当前协议数量少，投入明显过大。

3. **`OPENCLAW` 类型使用专门表单，并将 Markdown 提示词直接映射到 `systemPrompt`**
   - **决定**：`OPENCLAW` 表单至少提供 `systemPromptMarkdown`、`allowedTools`、`orchestration.mode` 等字段；其中 Markdown 文本区保存时直接写入 `configuration.systemPrompt`，不做 Markdown 到 HTML 的转换。
   - **理由**：用户要的是更易维护的提示词输入，而运行时实际消费的仍是纯文本 prompt，保留原始 Markdown 最简单且兼容现有执行器。
   - **替代方案**：引入富文本编辑器或额外 prompt 模板字段。会增加复杂度，也超出当前问题范围。

4. **编辑加载时先解析到草稿模型，解析失败则阻止结构化保存**
   - **决定**：打开已有 Skill 编辑时，系统先把 `configuration` JSON 解析成对应草稿；若缺关键字段或 `kind/executionMode` 与既有协议不匹配，则进入只读/错误提示状态，不允许用户在未知结构上直接保存。
   - **理由**：结构化编辑最怕“读不全却写回去”，阻止不可靠覆盖比偷偷丢字段安全。
   - **替代方案**：解析失败时退回原始 JSON 编辑。兼容性更高，但与本次“去 JSON 维护”目标冲突。

5. **字段校验前移到表单层，保存前统一做序列化校验**
   - **决定**：每类 Skill 在表单上就校验必填项、URL/命令/工具列表等基础格式，提交前再执行一次 `draft -> configuration` 序列化校验，确保写入后一定是当前协议支持的合法 JSON。
   - **理由**：这可以把错误尽早暴露给用户，并保证最终落库格式稳定。
   - **替代方案**：仅依赖后端校验。实现更简单，但用户体验会退回“提交后才知道哪里错了”。

6. **工具白名单采用可维护列表输入，而非手写 JSON 数组**
   - **决定**：`OPENCLAW.allowedTools` 使用可增删的列表式输入，并优先从当前 Skill 列表/已知工具集中提供可选项。
   - **理由**：白名单是自主规划 Skill 的核心安全边界，用结构化列表比手写 JSON 更不容易出错。
   - **替代方案**：保留逗号分隔文本输入。实现较快，但校验和去重体验较差。

## Risks / Trade-offs

- **[Risk] `CONFIG` 协议字段可能继续增长，表单分支会逐步变多** → **Mitigation**: 用按 `kind` 分段的 serializer/parser 注册表集中管理字段映射，避免逻辑散落在组件模板里。**
- **[Risk] 历史数据存在非标准配置，导致无法结构化回填** → **Mitigation**: 明确提供解析失败提示，并保留查看原始配置能力，但不默认允许覆盖保存。**
- **[Risk] Markdown 提示词中包含引号、换行后序列化出错** → **Mitigation**: 始终通过对象序列化生成 JSON，禁止手拼字符串。**
- **[Risk] 前端和后端对配置协议理解不一致** → **Mitigation**: 将两类 Skill 的字段约定整理为共享文档/测试样例，并对典型 Skill 做回填与保存联调。**
- **[Risk] 切掉原始 JSON 入口后，高级用户无法快速录入少数实验配置** → **Mitigation**: 首版聚焦已支持协议；若后续确有需求，再评估增加受控的“高级模式”。**

## Migration Plan

1. 先定义两类 Skill 的编辑态字段模型，以及对应的 parser / serializer 规则。
2. 更新 Skill 管理窗口，在 `executionMode` 维度下切换不同表单，而不是暴露单一 JSON 文本区。
3. 为现有种子 Skill 和历史记录补充解析回填逻辑，验证典型 `time`、`api`、`monitor`、`openclaw` 配置都能正常打开编辑。
4. 在保存链路中统一通过 serializer 生成 `configuration`，保持对后端持久化协议兼容。
5. 补充前端表单验证与读写联调，确认 Markdown 提示词、工具白名单和历史数据兜底行为都符合预期。

回滚时可先恢复原始 JSON 输入框，保留 parser / serializer 代码不启用；因为数据库格式不变，不需要数据回滚。

## Open Questions

- `CONFIG` 类型首版是否只覆盖当前已落库的 `time` / `api` / `monitor` 三类协议，还是要顺带预留更多未使用协议的表单定义？
- 解析失败时，管理窗口应完全禁止编辑，还是允许“查看原始配置但不可保存”的只读降级模式？
