## Context

当前 API Skill 的异步轮询在后端 agent-core 层已支持 SINGLE_CALL 和 PERIODIC 两种策略，`frontend/src/utils/skillEditor.ts` 中的 `ApiConfigDraft` 类型也定义了相关字段（`asyncPollEnabled`、`asyncPollStrategy`、`asyncPollReadTimeoutSeconds`、`asyncPollText`）。但合并后前端改用 ConfigFormRenderer schema 驱动渲染，而后端 `SystemSkillController.buildApiConfigSchema()` 仅暴露了一个 `asyncPoll` JSON 编辑器字段，导致 SINGLE_CALL 策略和 read timeout 配置无法在前端表单中配置。

**约束**：不新增第三方包、不新增环境变量、优先修改现有代码。

## Goals / Non-Goals

**Goals:**
- 后端 schema 新增 `asyncPollEnabled`（checkbox）、`asyncPollStrategy`（radio）、`asyncPollReadTimeoutSeconds`（number）字段
- ConfigFormRenderer 支持 `checkbox` 和 `radio` UI 类型
- ConfigFormRenderer 支持字段条件可见性（`visibleWhen`），使 SINGLE_CALL / PERIODIC 的关联字段按策略显示
- SkillManagementModal 的 `draftToFormValues` / `updateDraftFromFormValues` 正确序列化/反序列化新增字段

**Non-Goals:**
- 不修改 agent-core 的异步轮询执行逻辑
- 不修改 gateway 的 async_tasks 表结构
- 不新增后端 API 端点

## Decisions

### 1. Schema 字段设计

当前 `asyncPoll` 字段是 `type: "object"` JSON 编辑器，新增三个独立字段不改变其语义：

| 字段名 | type | ui | 说明 |
|--------|------|-----|------|
| `asyncPollEnabled` | boolean | checkbox | 是否启用异步轮询 |
| `asyncPollStrategy` | string | radio | PERIODIC / SINGLE_CALL |
| `asyncPollReadTimeoutSeconds` | number | number | SINGLE_CALL read timeout，`visibleWhen` 仅 SINGLE_CALL 可见 |
| `asyncPoll` | object | jsonEditor | PERIODIC 的 JSON 配置，`visibleWhen` 仅 PERIODIC 可见 |

**理由**：新增字段保持 `ApiConfigDraft` 中已有字段完全对齐，`skillEditor.ts` 的序列化逻辑无需改动。

### 2. ConfigFormRenderer 新增 UI 类型

- **checkbox**: 使用 TDesign `<t-checkbox>` 组件，`modelValue` 绑定 `boolean`
- **radio**: 使用 TDesign `<t-radio-group>` 组件，`enum` 数组作为选项

**理由**：TDesign 原生组件支持完备，不需要引入第三方库。schema 中的 `enum` 字段已存在（用于 select），可复用给 radio。

### 3. 字段条件可见性（visibleWhen）

在 schema property 中增加可选的 `visibleWhen` 字段：

```json
{
  "visibleWhen": {
    "field": "asyncPollStrategy",
    "equals": "SINGLE_CALL"
  }
}
```

ConfigFormRenderer 中通过 `computed` 过滤 properties，只渲染满足条件的字段。

**理由**：比直接在模板中硬编码条件更通用，未来其他 schema 可复用。模型优先设计在 schema property 上，不污染组件 props。

### 4. SkillManagementModal 字段对齐

`draftToFormValues` 需要在返回值中增加 `asyncPollEnabled`、`asyncPollStrategy`、`asyncPollReadTimeoutSeconds` 三个字段（从 `apiDraft` 中读取）。

`updateDraftFromFormValues` 需要从 `values` 中读取这些字段写回 `apiDraft`。

**理由**：当前 `updateDraftFromFormValues` 仅从 `asyncPoll` JSON 值推导 `asyncPollEnabled`（存在则启用），缺少策略和 timeout 的回路。

## Risks / Trade-offs

- [Schema 与 ApiConfigDraft 字段不一致] → 新增的 schema 字段名必须与 ApiConfigDraft 中的字段名完全对齐；如果后续新增 execution type，需要确保 ConfigFormRenderer 的 checkbox/radio 行为适用 → 在 ConfigFormRenderer 中做通用实现、不耦合具体类型
- [visibleWhen 嵌套过深] → 当前仅支持一层 `field.equals` 判断，不处理复合条件 → 明确在 schema 文档中说明 `visibleWhen` 的限制范围
- [向后兼容] → 旧 asyncPoll JSON 对象中可能包含 `pollStrategy` 和 `singleCallReadTimeoutSeconds` 字段，这些在 `skillEditor.ts` 的 `parseDraftFromApiSkill` 中已有处理逻辑，无需变更
