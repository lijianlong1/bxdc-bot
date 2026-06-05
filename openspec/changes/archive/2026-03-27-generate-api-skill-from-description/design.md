## Context

当前系统已经具备两块基础能力：一是 `SkillGateway` 可以持久化 `skills` 记录并提供 CRUD / API 代理接口；二是 `Agent Core` 可以在运行时从 `GET /api/skills` 动态加载 `type=EXTENSION` 的 skill，并根据 `configuration` 执行 API / 时间 / 服务器状态等能力。缺口在于，用户仍然需要手工把 API 文档转换成系统认可的 skill 配置，且生成后没有自动试跑验证环节。

## Goals / Non-Goals

**Goals:**
- 提供一个 built-in skill，接收自然语言或结构化 API 描述并生成符合当前标准的 API skill 数据。
- 让生成出的 skill 可以直接写入 `SkillGateway.skills` 表并被现有动态加载机制识别。
- 在生成并保存后立即执行一次验证调用，让用户当场知道该 skill 是否可用。
- 对字段缺失、接口描述不完整、调用失败、返回不可解析等情况给出可操作的错误反馈。

**Non-Goals:**
- 不在本次变更中重构全部 skill 类型的配置协议，只覆盖 API 类型 skill 的自动生成。
- 不引入新的执行网关或新的持久化存储，继续复用现有 `SkillGateway` 与 H2/数据库结构。
- 不处理复杂的 OAuth、多步鉴权、签名算法推导等高级第三方 API 接入流程，仅支持当前标准可表达的请求配置。

## Decisions

1. **以 built-in skill 形式实现生成器**
   - **决定**：在 `Agent Core` 中新增一个 built-in skill，而不是把“从描述生成 skill”做成前端表单逻辑。
   - **理由**：该功能本质上依赖 LLM 对 API 描述的理解和配置归纳，放在 Agent Core 内更接近现有 tool 选择和执行链路。
   - **替代方案**：前端增加“生成 skill”表单向导。该方案适合固定字段录入，但不适合自由文本 API 描述解析。

2. **生成结果采用当前数据库标准**
   - **决定**：生成器输出必须直接映射到现有 `skills` 表结构，即 `name`、`description`、`type=EXTENSION`、`configuration`、`enabled`、`requiresConfirmation`。
   - **理由**：避免引入新的中间格式，确保生成后的 skill 可以被 `loadGatewayExtendedTools()` 立即消费。
   - **替代方案**：新增一层草稿格式再转换。该方案会增加状态管理复杂度，当前收益较低。

3. **API 类型配置遵循统一最小协议**
   - **决定**：面向 API skill 生成统一配置子集，包括 `kind=api`、`operation`、`method`、`endpoint`、可选 `headers`、`query`、`apiKeyField`、`apiKey`、`autoTimestampField`。
   - **理由**：这一协议已经与当前 `executeConfiguredApiSkill()` 的执行方式兼容，可直接落地。
   - **替代方案**：为每个第三方 API 单独定义专用 `operation`。这会导致内置逻辑持续膨胀，不利于扩展。

4. **验证采用“保存后立即执行一次”的串联流程**
   - **决定**：built-in skill 在生成配置后，先调用 SkillGateway 创建/更新 skill，再立即触发一次新 skill 的执行验证。
   - **理由**：这样用户拿到的是“已入库且已验证”的结果，而不是只得到一份未确认可用的配置。
   - **替代方案**：仅生成不验证，或验证通过后再保存。前者体验不闭环，后者在失败时不利于保留调试上下文。

5. **验证输入由生成器给出推荐值**
   - **决定**：生成器除 skill 配置外，还要产出一份推荐测试输入，用于第一次执行验证。
   - **理由**：很多 API 需要 `page`、`id`、`keyword` 等参数，仅靠空输入无法验证可用性。
   - **替代方案**：要求用户二次补充验证参数。该方案更安全，但会打断“描述即生成”的主流程。

## Risks / Trade-offs

- **[Risk] 用户提供的 API 描述不完整，无法生成可执行配置** → **Mitigation**: 生成器在缺少关键字段时停止创建，并明确指出缺少的方法、地址、必填参数或鉴权信息。**
- **[Risk] 生成的 `description` 过弱，后续 LLM 不易正确调用该 skill** → **Mitigation**: 在生成器中明确产出“适合模型理解”的用途描述，而不只是复制原始接口文档。**
- **[Risk] 第一次验证依赖外部 API 稳定性，可能出现偶发失败** → **Mitigation**: 将“生成成功”和“验证成功”分开报告，保留失败原因与请求参数，便于用户重试。**
- **[Risk] 自动生成的请求包含敏感 key/参数** → **Mitigation**: 允许生成器标记敏感字段，并优先通过占位或显式确认方式回填，而不是默认暴露在聊天文本中。**


