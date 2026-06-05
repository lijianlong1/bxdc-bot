## Why

当前 Skill 执行确认机制仅支持简单的"是否确认执行"二选一，无法满足以下场景：

1. **参数多、手动选更快** — LLM 填的参数可能有误或用户想快速调整某个枚举值，比用自然语言描述修改更快
2. **动态选项** — 某些参数的可选值依赖外部系统（如集群列表、项目列表），需要实时获取
3. **存量 enum 展示不佳** — 当前 `parameterContract.properties` 的 `enum` 只支持 `string[]`，下拉框展示值和传值相同，不直观

## What Changes

### 核心约束

**仅当 Skill 同时满足两个条件时才弹出参数确认表单**：
1. `requiresConfirmation = true`
2. `configuration.parameterContract.properties` 存在且有内容

不满足则**回退到现有行为**（简单确认框 / 直接执行）。

### 1. `enum` 格式扩展（向后兼容）

```json
// 存量格式（继续支持）
"env": { "type": "string", "enum": ["dev", "test", "prod"] }

// 新格式（label/value 对，下拉框展示中文名）
"env": { "type": "string", "enum": [
  { "label": "开发环境", "value": "dev" },
  { "label": "测试环境", "value": "test" }
]}
```

- 存量 `string[]` → 下拉框 label = value
- 新格式 `{label, value}[]` → 下拉框 label 展示 → 传值用 value
- Ajv 校验前归一化为 `string[]`，不影响执行逻辑

### 2. `enumSource` 动态枚举（新字段）

```json
"project_id": {
  "type": "string",
  "description": "项目",
  "enumSource": {
    "url": "https://ops-api.example.com/api/v1/projects",
    "method": "GET",
    "headers": { "X-Auth-Token": "{{sys:ops_token}}" },
    "jsonPath": "data.items",
    "valueKey": "id",
    "labelKey": "name",
    "searchParam": "keyword",
    "refreshIntervalSec": 300
  }
}
```

| 字段 | 说明 | 默认 |
|------|------|------|
| `url` | 字典接口地址 | 必填 |
| `method` | HTTP method | `GET` |
| `headers` | 请求头 | `{}` |
| `jsonPath` | 响应中提取选项数组的路径 | `""`（整个响应是数组） |
| `valueKey` | 值的字段名 | `"value"` |
| `labelKey` | 展示名的字段名 | `"label"` |
| `searchParam` | 搜索参数名，拼到 URL 上 | 无（不支持搜索） |
| `refreshIntervalSec` | 前端缓存时长 | `300` |

### 3. Gateway 代理端点

```
POST /api/skills/enum-source
```

前端不直调外部 API，通过 Gateway 代理（避免跨域、隐藏 token）。

### 4. ParameterConfirmModal（新增前端组件）

弹窗内容：
- 遍历 `parameterContract.properties`
- 按字段类型渲染控件：`enum` → 下拉框 / `enumSource` → 远程搜索下拉框 / 普通 → 输入框
- **预填 LLM 选择的参数值**
- 用户可修改
- 确认后，调整后的参数回传给 Agent Core 执行

### 5. SKILL GENERATOR 支持新字段

SKILL GENERATOR 生成/修改 API Skill 时，`parameterContract` 的 LLM prompt describe 更新：
- `enum` 支持 `string[]` 或 `[{label, value}]` 双格式
- 可选 `enumSource` 字段，LLM 可自主生成动态枚举配置

### 6. AI 文本优化新增 field_id

新增 `api_parameter_contract_enum`，专用于优化 `properties` 内各字段的 `enum`/`enumSource` 配置。在 Skill 编辑表单的参数契约编辑区增加"✨ AI 优化枚举"按钮。

### 不改动的

- 数据库 — 无新表，参数契约存在 `skills.configuration` JSON
- Gateway 执行链路 — 参数校验和 API 调用逻辑不变
- Agent Core 执行逻辑 — `enumSource` 对 Ajv 透明
- 存量 Skill — 无 `requiresConfirmation` 或无 `parameterContract` 时行为完全不变

## Capabilities

### New Capabilities
- `skill-parameter-confirm-form`: 当 `requiresConfirmation=true` 且存在 `parameterContract` 时，弹出参数确认表单，支持枚举下拉和动态选项

### Modified Capabilities
无

## Impact

**受影响的代码**：
- `backend/skill-gateway/controller/SkillController.java` — 新增 `POST /api/skills/enum-source`
- `backend/skill-gateway/config/SecurityConfig.java` — 放通上述端点
- `backend/agent-core/src/tools/java-skills.ts` — `parameterContract` schema 加 `additionalProperties: true`；新增 `normalizeEnumForValidation()`；SKILL GENERATOR describe 更新
- `backend/agent-core/src/features/optimize-text/optimize-text.service.ts` — 新增 `api_parameter_contract_enum` 内置提示词
- `docs/deploy-ddl/003-skill-text-prompts-seed.sql` — 新增种子数据
- `frontend/src/components/ParameterConfirmModal.vue` — **新增** 参数确认弹窗
- `frontend/src/composables/useChat.ts` — `confirmSkillAction` 支持传 adjustedParams
- `frontend/src/components/SkillManagementModal.vue` — 参数契约编辑区新增"✨ AI 优化枚举"按钮

**数据库变更**：无
