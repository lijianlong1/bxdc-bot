## Why

当前系统中的 skill 虽然已经可以通过数据库管理扩展能力，但执行模型仍偏向单一的“确定性配置驱动”模式，难以兼容 OpenClaw/Claude 这类基于 prompt 编排、多步串行调用工具的 skill 形态。随着后续希望同时保留稳定可审计的 handler/config skill，又引入更灵活的 prompt skill，系统需要先在规格层面明确两类 skill 的统一存储、区分展示与执行边界。

## What Changes

- 新增数据库级别的双类型 skill 模型，支持在同一张 `skills` 表中持久化“确定性执行 skill”和“OpenClaw 风格 prompt skill”。
- 定义 Agent 侧的双通道装载与执行规则：确定性 skill 继续按结构化配置执行，OpenClaw skill 按数据库中的 prompt/orchestration 定义驱动串行工具调用。
- 修改 Skill 列表展示要求，使前端能同时渲染两类 skill，并以“预配置”“自主规划”两种文案明确展示类型区分。
- 修改聊天窗口中的 skill 轨迹展示要求，使自主规划类 skill 的内部子工具调用也能被用户看到。
- 新增一个 OpenClaw 类型的示例 skill“查询距离生日还有几天”，要求串行调用查日期与计算工具完成结果生成。

## Capabilities

### New Capabilities
- `database-skill-types`: 定义数据库中两类 skill 的统一模型、元数据字段、加载规则与按类型分流执行行为。
- `openclaw-skill-orchestration`: 定义 OpenClaw 风格 prompt skill 的串行工具编排能力，以及“查询距离生日还有几天”示例 skill 的行为。

### Modified Capabilities
- `skill-hub-ui`: Skill 列表从仅区分 built-in/extended，扩展为可展示数据库 skill 的具体类型，并为不同类型提供清晰标识。
- `compute-skill`: 补充日期差值相关计算能力，为 OpenClaw 类型的生日倒计时 skill 提供可复用的计算工具。
- `chat-ui`: 聊天窗口需要展示自主规划 skill 的内部子工具调用轨迹。
- `agent-client`: 前端客户端需要解析带层级关系的 skill/tool 事件。
- `api-gateway`: 任务事件流需要输出可标识父子关系的 skill/tool 轨迹事件。

## Impact

- 影响 `backend/skill-gateway` 的 skill 数据模型、初始化数据与查询接口。
- 影响 `backend/agent-core` 的 skill 加载、Tool 注册、运行时执行分流与示例 skill 注入方式。
- 影响现有计算能力的接口契约，需要增加面向日期差值的运算支持。
- 影响前端 Skill 列表页/抽屉的渲染结构与类型标签展示。
- 影响聊天窗口的执行轨迹展示与 SSE 事件解析模型。
- 影响现有扩展 skill 的兼容策略，需要保证旧数据在未补全类型前仍可被识别或迁移。
