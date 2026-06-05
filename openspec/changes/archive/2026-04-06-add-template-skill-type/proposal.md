## Why

产品需要一种仅承载提示词（prompt）的可复用 Skill，供对话或编排引用，而不绑定 HTTP 或 SSH 等具体执行形态。现有 CONFIG 型 Skill 以 API、SSH 为主，缺少「纯模板」类别；统一纳入 SkillGateway 与生成流程，可降低碎片化配置和维护成本。

## What Changes

- 新增任务/Skill 类型 **模板**：`executionMode` 为 CONFIG，与 API、SSH 同属基于 configuration 的扩展 Skill。
- **Configuration** 仅包含一个字段：**提示词**（与现有代码中的 `systemPrompt` 或专用 `prompt` 字段对齐，具体键名在 design 中约定）。
- **SkillGateway**（实体、校验、可选种子数据）与 **agent-core** 侧加载/执行或透传逻辑按需扩展，使模板类 Skill 可被识别与使用。
- **内置 Skill 生成器**（`JavaSkillGeneratorTool` / skill generator）：支持根据用户意图生成该类型的 Skill 并写入 Gateway。
- **前端 Skill 管理**（若现有编辑器按 kind 区分表单）：增加「模板」表单项（仅提示词）。

## Capabilities

### New Capabilities

- `template-config-skill`：定义「模板」类 CONFIG Skill 的数据形态、校验规则、与 API/SSH 的并列关系及运行时语义（例如：工具调用返回提示词内容或供上层消费）。

### Modified Capabilities

- `skill-kind-normalization`：将 CONFIG 下的 canonical `kind` 从仅 `api` / `ssh` **扩展**为包含 `template`（或等价命名），并规定校验与写入规则。
- `built-in-skill-generation`：Multi-type 生成工具须支持推断并生成 `template` CONFIG Skill；补充对应 Requirement 与场景。

## Impact

- **后端**：`skill-gateway`（`Skill` 实体、`SkillService` 校验、`data.sql` 如有示例）、可能涉及的 DTO/Controller 测试。
- **agent-core**：`java-skills.ts`（或等价）中 `parseSkillConfig`、工具注册与执行分支；生成器相关 TypeScript/Java（视项目实际实现而定）。
- **前端**：`SkillManagementModal.vue`、`useSkillHub.ts` 等与 kind/表单相关的文件。
- **规范**：新建 `template-config-skill` spec；为 `skill-kind-normalization`、`built-in-skill-generation` 编写 delta spec（若本 change 的 schema 要求单文件 delta，则按 `openspec instructions specs` 输出路径放置）。
