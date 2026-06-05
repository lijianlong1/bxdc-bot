## Context

当前扩展 skill 的 `kind` 混合了“基础连接类型”和“场景模板”两种语义：
- `api` 表示基础调用通道；
- `time` 实际是某个固定 API 调用模板；
- `monitor` 实际是某个固定服务器巡检脚本模板。

这种建模方式导致：
- 生成器难以稳定推断目标结构（同层级语义不一致）；
- 后端校验规则与前端展示文案长期耦合到历史命名；
- 后续新增模板时容易继续“新增 kind”，放大复杂度。

该变更跨越 `backend/skill-gateway`、`backend/agent-core`、`frontend`，并涉及历史数据兼容，因此需要单独设计。

## Goals / Non-Goals

**Goals:**
- 将 `kind` 统一为基础类型：`api`、`ssh`。
- 将 `time`、`monitor` 等能力下沉为模板字段（例如 `preset/profile`），作为 `api/ssh` 的预配置 skill。
- 提供向后兼容：既有 `time`/`monitor` skill 在迁移阶段可继续运行并可被平滑转换。
- 统一生成器、校验器、UI 展示语义，减少“类型”概念歧义。

**Non-Goals:**
- 不在本次变更重构 OPENCLAW 执行模型。
- 不引入新的执行引擎（仍复用现有 API/SSH 网关能力）。
- 不一次性删除所有旧字段（允许阶段性兼容窗口）。

## Decisions

### 1) Canonical kind only: `api` and `ssh`
- **决策**：后端新增 canonical 校验规则，只把 `api`、`ssh` 视为长期有效 kind。
- **原因**：`kind` 表示“如何连接/执行”，而非“执行什么业务场景”。
- **备选方案**：
  - 继续保留 `time`、`monitor` 为 kind：短期改动小，但语义债务持续增加，否决。

### 2) Introduce preset/profile for scenario specialization
- **决策**：在配置中增加模板标识（命名待定：`preset` 或 `profile`），例如：
  - `kind=api`, `preset=current-time`
  - `kind=ssh`, `preset=server-status-monitor`
- **原因**：模板表达“预配置 skill”，与基础类型解耦；便于未来扩展更多模板而不新增 kind。
- **备选方案**：
  - 用 `operation` 继续承载全部语义：可行但可读性差，且难以区分基础能力与模板能力，否决。

### 3) Compatibility and migration strategy
- **决策**：采用“双读+新写”策略。
  - 新写入统一按 canonical kind + preset。
  - 读取旧数据时，运行期兼容解析 `time`/`monitor`，并在保存/编辑时自动转换为新结构。
- **原因**：避免线上已有 skill 因规则收敛立刻失效。
- **备选方案**：
  - 强制一次性离线迁移并禁用旧格式：风险高、发布窗口要求高，否决。

### 4) Generator/UI alignment
- **决策**：
  - `JavaSkillGeneratorTool` 生成时只输出 `api` 或 `ssh` kind（OPENCLAW 仍走 executionMode 维度）。
  - Skill Hub 与编辑器展示“基础类型 + 预配置模板”。
- **原因**：确保用户认知、LLM生成、后端校验三方一致。

## Risks / Trade-offs

- [风险] 旧 skill 在部分边界输入下转换错误 → **缓解**：增加兼容解析测试样例（`time`/`monitor`/缺省字段）并保留回退路径。
- [风险] 前后端字段命名不一致（`preset` vs `profile`） → **缓解**：在设计阶段冻结字段名，并在 spec 中单点定义。
- [风险] 迁移期逻辑分支增加维护成本 → **缓解**：明确兼容窗口，后续按版本移除旧分支。
- [权衡] 先兼容再清理会延缓代码“完全整洁” → **收益**：显著降低生产变更风险。

## Migration Plan

1. 在 spec 中冻结 canonical 模型（kind + preset）和旧模型映射规则。
2. skill-gateway 增加兼容读取与新模型校验。
3. agent-core 生成器改为新模型输出，并保持旧模型识别能力。
4. 前端编辑器与列表展示改为“类型 + 模板”。
5. 增加迁移脚本（可选）批量把存量数据转换为新模型。
6. 发布后观察一段兼容期，再评估移除旧模型写入能力。

回滚策略：若上线异常，可暂时恢复旧校验放行与旧写入路径，保持读取兼容不变。

## Open Questions

- 模板字段统一命名为 `preset` 还是 `profile`？
- `ssh` 类型的最低必填字段是否固定为 `command`，是否需要 `targetResolver` 明确路由？
- 是否需要在 UI 中对“模板”增加只读标签（避免用户误改关键模板标识）？
