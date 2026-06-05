## 1. Gateway — `enum-source` 代理端点

- [x] 1.1 在 `SkillController.java` 新增 `POST /api/skills/enum-source` 端点
  - 接收 RequestBody 含字段：`url`、`method`（默认 `"GET"`）、`headers`（默认 `{}`）、`jsonPath`、`valueKey`、`labelKey`、`searchParam`、`searchQuery`（可选）
  - 如果 `searchQuery` 非空且 `searchParam` 非空：将 `searchParam=URLEncoder.encode(searchQuery)` 拼接到 url
  - 调 `apiProxyService.callApi(url, method, headers, null)` 获取原始响应
  - 用 `objectMapper.readValue(response...)` 解析为 Object
  - 用 `extractValueByPath`（复用 `AsyncTaskPollingService` 的路径导航逻辑，提为公共方法或复制）按 `jsonPath` 提取数组
  - 遍历数组 → `Map.of("label", item.get(labelKey).toString(), "value", item.get(valueKey).toString())`
  - 返回 `List<Map<String, String>>`
- [x] 1.2 将 `extractValueByPath` 提取为公共工具类 `JsonPathUtils`（新增 `util/JsonPathUtils.java`），`AsyncTaskPollingService` 和 `SkillController` 共用
- [x] 1.3 在 `SecurityConfig.java` 放通 `POST /api/skills/enum-source`

## 2. Agent Core — `parameterContract` Schema 兼容

- [x] 2.1 Ajv `compile` 前通过 `normalizeParameterContractForValidation` 剥离 `enumSource` 等未知字段（等效 `additionalProperties: true`）
- [x] 2.2 新增 `normalizeEnumForValidation(raw: unknown): string[]` 工具函数：
  - 如果不是数组 → 返回 `[]`
  - 遍历：若元素是 string → 原样；若元素是 `{value: string}` → 取 `value`
- [x] 2.3 `normalizeParameterContractForValidation` 遍历 `properties`，对含 `enum` 的 prop 调 `normalizeEnumForValidation` 替换
- [x] 2.4 更新 SKILL GENERATOR 中 `parameterContract` 的 describe：
  - `enum` 支持 `string[]` 或 `[{label, value}]` 双格式
  - 可选 `enumSource` 字段，含 `url`/`method`/`headers`/`jsonPath`/`valueKey`/`labelKey`/`searchParam`/`refreshIntervalSec`
- [x] 2.5 更新 `parameterContract` describe 同时覆盖了 properties 子属性的格式说明
- [~] 2.6 ~~新增 AI 文本优化 field_id `api_parameter_contract_enum`~~ 已废弃：功能合并到 `api_parameter_contract`（2.4/2.5 已完整覆盖 enum/enumSource 提示）
- [x] 2.7 同步更新 `docs/deploy-ddl/003-skill-text-prompts-seed.sql`（`api_parameter_contract` 提示词升级，`api_parameter_contract_enum` 行移除）

## 3. 前端 — ParameterConfirmModal 组件

- [x] 3.1 创建 `frontend/src/components/ParameterConfirmModal.vue`
  - Props: `visible: boolean`、`skillName: string`、`parameterContract: ApiParameterContract`、`llmValues: Record<string, unknown>`
  - Emits: `confirm(adjustedParams: Record<string, unknown>)`、`cancel()`
- [x] 3.2 实现 `normalizeEnumOptions` 工具函数（string[] → label/value 对）
- [x] 3.3 渲染逻辑：
  - 遍历 `parameterContract.properties`
  - `prop.enum` → `<t-select filterable :options="staticOptions[key]">`
  - `prop.enumSource` → `<t-select filterable remote :remote-method="onSearch" @focus="onFocus">`，内部调 `POST /api/skills/enum-source`
  - 其他 → `<t-input>` / `<t-input-number>` / `<t-switch>`
  - 所有控件绑定 `v-model="values[key]"`
- [x] 3.4 `onFocus` 时首次 fetch（无 searchQuery），结果缓存到 `optionsCache`
- [x] 3.5 `onSearch` 时带 `searchQuery` fetch，字典接口侧完成搜索
- [x] 3.6 确认按钮 → `emit('confirm', { ...values })`；取消 → `emit('cancel')`
- [x] 3.7 `watch(visible)` → 打开时预填 LLM 值 + `default` 值到 `values`

## 4. 前端 — 对话面板集成

- [x] 4.1 在 `MessageList.vue` 的 `handleConfirmation` 中检测两个条件：
  - 用户点击"确认执行"
  - 对应 Skill 的 `configuration.parameterContract` 通过 `resolveParameterProperties` 解析出非空 properties（兼容标准 + 扁平格式）
- [x] 4.2 满足条件时：渲染 `ParameterConfirmModal`，传入 `llmValues = conf.arguments`
- [x] 4.3 用户确认后：调 `confirmSkillAction(toolCallId, true, adjustedParams)`
- [x] 4.4 不满足条件时：调现有简单确认逻辑（`confirmSkillAction(toolCallId, confirmed)` 不走参数表单）
- [x] 4.5 `confirmSkillAction` 方法签名扩展为 `(toolCallId: string, confirmed: boolean, adjustedParams?: Record<string, unknown>)`，透传到 `confirmAction` → Agent Core `POST /agent/confirm` → `Command({ resume: { adjustedParams } })` → `java-skills.ts` 合并参数

## 5. 后续修正

- [x] 5.1 `resolveParameterProperties` 兼容扁平格式 `{"env":{"type":"string"}}`（无外层 `{"type":"object","properties":{...}}`）
- [x] 5.2 `api_parameter_contract` AI 优化提示词合并 enum/enumSource 能力，删除 `api_parameter_contract_enum` field_id 和前端"AI 优化枚举"按钮
- [x] 5.3 `formatOptimizedText` 修复 `text.trim is not a function` — 兼容 LLM 直接返回 object 的情况
- [x] 5.4 `ApiTokenFilter` 放通 `POST /api/skills/enum-source` — 排除 `isEnumSource` 路径，不要求 `X-Agent-Token`

## 6. 验证

- [x] 6.1 存量 Skill（无 `requiresConfirmation` + 无 `parameterContract`）：没有 confirmation_request 事件 → 不受影响
- [x] 6.2 存量 Skill（有 `requiresConfirmation` 但无 `parameterContract`）：仍弹简单确认框
- [x] 6.3 新 Skill（`requiresConfirmation=true` + `enum: string[]`）：确认弹窗显示下拉，label=value
- [x] 6.4 新 Skill（`requiresConfirmation=true` + `enum: [{label,value}]`）：下拉显示中文名
- [x] 6.5 新 Skill（`requiresConfirmation=true` + `enumSource`）：下拉首次 focus fetch，支持远程搜索
- [x] 6.6 `mvn compile` + `npm run build` 无错误
