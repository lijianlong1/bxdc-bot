## Context

当前数据库里的可加载 skill 基本都走 `type=EXTENSION + configuration` 这一路径，`Agent Core` 也只按配置分发到确定性的执行器中。这样适合 API、时间、监控等稳定任务，但无法表达 OpenClaw/Claude 风格的“一个 skill 内部再基于 prompt 串行调用多个工具”的能力。同时，前端 Skill 列表目前主要展示来源分组，尚未对数据库 skill 的执行类型做清晰区分。

这次改造是一个跨模块变更：`SkillGateway` 需要扩展数据模型与列表接口，`Agent Core` 需要按类型加载并执行不同 skill，前端需要识别并渲染类型标签；此外还要引入一个真实的 OpenClaw 类型示例 skill 来验证整条链路。

## Goals / Non-Goals

**Goals:**
- 让两类数据库 skill 可以共存在同一套持久化模型中，并可通过同一列表接口返回。
- 保持现有配置驱动 skill 的兼容性，不要求现有 API/时间/监控 skill 全量重写。
- 为 OpenClaw 风格 skill 定义最小可执行协议，使其能够以受限工具集完成串行编排。
- 在前端列表中清晰展示每个数据库 skill 的执行类型。
- 提供“查询距离生日还有几天”示例 skill，验证 prompt skill 与基础工具的串行协作。

**Non-Goals:**
- 不把所有 built-in skill 迁移进数据库；本次只覆盖数据库侧的双类型扩展。
- 不实现任意 DAG、并行工作流或复杂计划执行器；OpenClaw 类型先只支持串行编排。
- 不在本次变更中重做聊天消息中的全部工具追踪 UI；重点是列表展示与执行模型落地。
- 不引入新的持久化表来拆分 prompt skill 与 config skill，优先在现有 `skills` 模型上演进。

## Decisions

1. **保留 `type` 作为来源字段，新增 `executionMode` 区分执行类型**
   - **决定**：保留现有 `skills.type=EXTENSION` 的装载语义，新增顶层字段 `executionMode`（例如 `CONFIG` / `OPENCLAW`）描述数据库 skill 的执行类型。
   - **理由**：现有 Agent 代码和数据已依赖 `type=EXTENSION` 作为“可动态加载”的筛选条件，直接复用 `type` 会打破已有语义，也不利于后续继续扩展来源维度。
   - **替代方案**：把类型放进 `configuration.kind`。该方式能少改表结构，但前端列表、接口过滤、迁移默认值都会更难处理。

2. **两类 skill 共用同一张表，但使用不同的配置子协议**
   - **决定**：`CONFIG` skill 继续使用当前 `configuration` 结构；`OPENCLAW` skill 的 `configuration` 改为 prompt 编排协议，例如包含 `systemPrompt`、`allowedTools`、`orchestration.mode=serial`、输入说明等字段。
   - **理由**：单表模型便于沿用现有 CRUD 和启停能力，同时让每种 skill 的运行时协议保持独立清晰。
   - **替代方案**：为 OpenClaw skill 单独建表。这样结构更“纯”，但会重复已有管理接口和列表逻辑，当前收益不足。

3. **Agent 对两类数据库 skill 都包装成外层 Tool，但内部执行器不同**
   - **决定**：两类数据库 skill 依旧都被注册为可调用 Tool；`CONFIG` skill 继续走已有 handler/config 执行链路，`OPENCLAW` skill 则由一个专用 prompt executor 在受限工具集内完成串行调用。
   - **理由**：这样可以最大限度复用当前 LangGraph/tool-calling 模型，也能让前端和日志层继续把它们视作统一的 skill 调用事件。
   - **替代方案**：把 OpenClaw skill 直接展开成多条普通 prompt。该方案不利于重用、管理与列表化展示。

4. **OpenClaw prompt executor 只暴露白名单工具，并强制串行执行**
   - **决定**：`OPENCLAW` skill 的配置必须声明 `allowedTools`，执行时仅向内部 prompt 暴露这些工具，并限制编排模式为 `serial`。
   - **理由**：这是兼容 OpenClaw 风格的最小安全边界，可避免 prompt skill 无限访问全部工具或产生不可控调用路径。
   - **替代方案**：默认暴露全部工具给 prompt skill。该方案实现简单，但风险过高，且难以做测试和审计。

5. **对外文案固定映射为“预配置 / 自主规划”**
   - **决定**：`executionMode` 的内部枚举仍使用 `CONFIG` / `OPENCLAW`，但对外展示统一映射为“预配置”与“自主规划”。
   - **理由**：内部值适合接口和代码保持稳定，中文文案更适合用户在列表与聊天窗口中理解，不应把底层枚举直接暴露给用户。
   - **替代方案**：直接在数据库中存中文枚举。该方案可读性高，但会让接口、代码常量与国际化扩展更难维护。

6. **自主规划 skill 的内部子工具调用轨迹必须可见**
   - **决定**：`OPENCLAW` skill 在执行时除展示外层 skill 状态外，还要把内部子工具调用作为从属轨迹输出给事件流与聊天窗口。
   - **理由**：自主规划 skill 的可理解性和可审计性高度依赖中间步骤可见，否则用户只能看到一个黑盒结果，难以建立信任。
   - **替代方案**：只展示外层 skill 最终结果。该方案实现更轻，但会损失调试能力和产品辨识度。

7. **生日倒计时示例 skill 采用“查当前日期 -> 推导下一次生日日期 -> 调用日期差值计算”模式**
   - **决定**：示例 OpenClaw skill 固定使用一个当前日期查询工具和增强后的计算工具；prompt 负责根据用户生日推导“下一次生日”的目标日期，再调用计算工具得出天数。
   - **理由**：这样能真实体现 prompt skill 的编排价值，同时把日期差值计算沉淀为通用基础能力，而不是把业务逻辑硬编码到示例 skill 里。
   - **替代方案**：给生日倒计时单独做一个确定性 handler。该方案容易实现，但无法验证 OpenClaw 类型 skill 的真实能力。

8. **生日输入不限定固定格式，但必须可澄清**
   - **决定**：生日倒计时 skill 不强制用户提供固定日期格式，允许自然语言或常见日期表达；若模型无法可靠解析，则必须要求用户澄清，而不是猜测。
   - **理由**：这更符合自主规划 skill 的交互预期，也避免为了方便实现而把用户体验退化成严格表单。
   - **替代方案**：只接受 `MM-DD` 或 `YYYY-MM-DD`。该方案更容易测试，但不符合本次想验证的自然语言编排能力。

9. **前端列表按来源分组不变，但数据库 skill 增加类型徽标/文案**
   - **决定**：Skill Hub 仍可保留 built-in / database 等来源维度，但对数据库 skill 必须额外展示 `CONFIG` / `OPENCLAW` 类型标签与说明。
   - **理由**：这样不会打乱现有列表结构，同时满足用户对“双类型可见且可区分”的目标。
   - **替代方案**：直接按执行类型重组整个列表。该方案改动更大，且会影响现有用户认知。

## Risks / Trade-offs

- **[Risk] OpenClaw 类型 skill 的输出稳定性弱于确定性 skill** → **Mitigation**: 限制为白名单工具 + 串行模式，并优先把通用计算下沉到确定性工具中。**
- **[Risk] 旧数据库记录没有 `executionMode`，升级后可能无法识别** → **Mitigation**: 数据迁移时为历史 `EXTENSION` 记录补默认值 `CONFIG`，Agent 侧也保留缺省兜底。**
- **[Risk] Prompt skill 可能依赖不存在或暂不可用的工具** → **Mitigation**: 保存或加载时校验 `allowedTools`，对缺失工具给出明确错误并阻止启用。**
- **[Risk] 类型信息只存在配置 JSON 中会导致前端列表难以稳定渲染** → **Mitigation**: 将执行类型提升为顶层字段，确保列表接口直接返回。**
- **[Risk] 内部子工具轨迹过于详细，导致聊天窗口噪音过大** → **Mitigation**: 首版只展示子工具名称、状态和简短摘要，不默认展开原始参数和完整响应。**
- **[Risk] 生日输入自然语言解析存在歧义，例如“下个月初一”或缺少年份** → **Mitigation**: 将“可解析则执行，不可解析则追问澄清”写入 skill 行为约束，禁止静默猜测。**
- **[Risk] 生日倒计时示例依赖日期差值能力，若计算接口不足会造成链路不闭环** → **Mitigation**: 同步扩展 `compute-skill` 规格，补齐日期差值运算作为底层能力。**

## Migration Plan

1. 在 `SkillGateway` 数据模型中新增 `executionMode` 字段，并将历史数据库 skill 回填为 `CONFIG`。
2. 扩展 CRUD / 列表接口与初始化 SQL，使新旧记录都能返回稳定的 `executionMode`。
3. 在 `Agent Core` 中实现按 `executionMode` 分流的装载逻辑，先保证 `CONFIG` 兼容，再接入 `OPENCLAW` executor。
4. 前端 Skill 列表读取并展示“预配置 / 自主规划”文案；若接口暂未返回该字段，则使用 `CONFIG` 兜底避免界面中断。
5. 扩展任务事件流与客户端解析能力，支持自主规划 skill 的内部子工具轨迹展示。
6. 最后新增并验证生日倒计时示例 skill，确认从数据库列表到实际执行链路全部闭环。

回滚时可先停用 `OPENCLAW` 类型记录，再让 Agent Core 忽略新类型并仅加载 `CONFIG` skill；数据库新增字段可保留，不影响旧逻辑读取。

## Open Questions

- 自主规划 skill 的内部轨迹是否需要支持折叠/展开，还是始终以内联方式展示？
