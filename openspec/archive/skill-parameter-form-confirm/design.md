## Context

现有 `requiresConfirmation` 仅弹"确认/取消"二选一弹窗。扩展为：当 Skill 有 `parameterContract.properties` 时，确认为参数可编辑表单。

**触发条件（两个都必须满足）**：
1. Skill 的 `requiresConfirmation = true`
2. `configuration.parameterContract.properties` 非空

不满足 → 回退到现有行为。

## Decisions

### 1. 确认表单 vs 编辑表单分离

**选择**：确认表单（ParameterConfirmModal）是**对话面板**的组件，不是 Skill 编辑表单的组件。

- 编辑 Skill 时：`SkillManagementModal` 里的 `parameterContractText` 文本框（原始 JSON 编辑 + AI 优化）不变
- 执行 Skill 时：从 `skills` 表读 `configuration.parameterContract` → 解析 `properties` → `ParameterConfirmModal` 渲染表单

**不把枚举编辑 UI 放进 Skill 编辑页**——保持编辑页只关注 JSON 配置。

### 2. `enum` 双格式设计

**存量格式**：
```json
"env": { "type": "string", "enum": ["dev", "test", "prod"] }
```

**新格式**：
```json
"env": { "type": "string", "enum": [
  { "label": "开发环境", "value": "dev" },
  { "label": "测试环境", "value": "test" }
]}
```

**前端渲染**：
```typescript
function normalizeEnumOptions(raw: (string | { label: string; value: string })[]): { label: string; value: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map(v => ({ label: v, value: v }));
  }
  return raw as { label: string; value: string }[];
}
```

**Ajv 校验前归一化**：
```typescript
function normalizeEnumForValidation(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item =>
    typeof item === 'string' ? item : (item as { value: string }).value
  );
}
```

在 Ajv `compile` 之前，把 schema 里的 `enum` 替换为 `normalizeEnumForValidation(props.enum)`，确保校验不失败。

### 3. Gateway `enum-source` 代理端点

**请求**：
```
POST /api/skills/enum-source
Content-Type: application/json

{
  "url": "https://ops-api.example.com/api/v1/projects",
  "method": "GET",
  "headers": { "X-Auth-Token": "xxx" },
  "jsonPath": "data.items",
  "valueKey": "id",
  "labelKey": "name",
  "searchParam": "keyword",
  "searchQuery": "天枢"         // 可选，不传则返回全量
}
```

**Gateway 处理逻辑**：
```
1. 从 body 提取各字段
2. 如果 searchQuery 非空且 searchParam 非空：
     url += (url含? ? '&' : '?') + searchParam + '=' + URLEncoder.encode(searchQuery, UTF-8)
3. apiProxyService.callApi(url, method, headers, null)
4. 拿到 response → objectMapper.readValue(..., Object.class)
5. 用 extractValueByPath 按 jsonPath 提取数组（复用 AsyncTaskPollingService 的路径解析）
6. map → [{ "label": obj.labelKey, "value": obj.valueKey }]
7. 返回 List<Map<String, String>>
```

**前端调用**：
```typescript
async function fetchEnumSource(source, searchQuery = '') {
  const res = await fetch('/api/skills/enum-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...source, searchQuery }),
  });
  return res.json(); // [{ label, value }]
}
```

### 4. ParameterConfirmModal 前端组件

```vue
<script setup lang="ts">
// props: visible, skillName, parameterContract, llmValues (LLM 选的参数)
// emits: confirm(adjustedParams), cancel

const optionsCache = reactive<Record<string, { label: string; value: string }[]>>({});
const loadingMap = reactive<Record<string, boolean>>({});
const loadedMap = reactive<Record<string, boolean>>({});

const properties = computed(() => props.parameterContract?.properties || {});
const values = reactive<Record<string, unknown>>({ ...props.llmValues });

function initValues() {
  // 预填 LLM 值 + parameterContract 的 default
  for (const [key, prop] of Object.entries(properties.value)) {
    if (!(key in values) && (prop as any).default !== undefined) {
      values[key] = (prop as any).default;
    }
  }
}

watch(() => props.visible, (v) => { if (v) initValues(); });

async function doFetchEnumSource(key: string, prop, searchQuery = '') {
  loadingMap[key] = true;
  try {
    const res = await fetch('/api/skills/enum-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prop.enumSource, searchQuery }),
    });
    optionsCache[key] = await res.json();
  } finally {
    loadingMap[key] = false;
  }
}

function onFocus(key: string, prop) {
  if (prop.enumSource && !loadedMap[key]) {
    doFetchEnumSource(key, prop);
    loadedMap[key] = true;
  }
}

function onSearch(key: string, prop, kw: string) {
  doFetchEnumSource(key, prop, kw);
}

const staticOptions = computed(() => {
  const out: Record<string, { label: string; value: string }[]> = {};
  for (const [key, prop] of Object.entries(properties.value)) {
    if ((prop as any).enum) {
      out[key] = normalizeEnumOptions((prop as any).enum);
    }
  }
  return out;
});

function confirm() { emit('confirm', { ...values }); }
function cancel() { emit('cancel'); }
</script>

<template>
  <t-dialog :visible="visible" header="确认执行参数" width="640px"
    :confirm-btn="null" :cancel-btn="null" @close="cancel">
    <t-form label-width="120px">
      <t-form-item v-for="(prop, key) in properties" :key="key"
        :label="(prop as any).description || key">
        <!-- 静态枚举 → dropdown -->
        <t-select v-if="(prop as any).enum" v-model="values[key]"
          :options="staticOptions[key]" filterable />
        <!-- 动态枚举 → remote search dropdown -->
        <t-select v-else-if="(prop as any).enumSource" v-model="values[key]"
          :options="optionsCache[key] || []" :loading="loadingMap[key]"
          filterable remote :remote-method="(kw: string) => onSearch(key, prop, kw)"
          @focus="onFocus(key, prop)" />
        <!-- 普通 string → input -->
        <t-input v-else v-model="values[key]" />
      </t-form-item>
    </t-form>
    <template #footer>
      <t-button variant="outline" @click="cancel">取消</t-button>
      <t-button theme="primary" @click="confirm">确认执行</t-button>
    </template>
  </t-dialog>
</template>
```

### 5. 对话面板集成

`useChat.ts` 中确认流程扩展：

```typescript
// 当收到 requiresConfirmation 的 tool_call
if (toolCall.requiresConfirmation) {
  const skill = skills.value.find(s => s.id === toolCall.skillId);
  const paramContract = skill?.configuration?.parameterContract;

  if (paramContract?.properties && Object.keys(paramContract.properties).length > 0) {
    // 渲染 ParameterConfirmModal，预填 toolCall.arguments
    showParamForm(toolCall, paramContract);
  } else {
    // 回退到现有简单确认框
    showConfirmDialog(toolCall);
  }
}
```

`confirmSkillAction` 扩展：
```typescript
async function confirmSkillAction(toolCallId: string, confirmed: boolean, adjustedParams?: Record<string, unknown>)
```

Agent Core 收到 adjustedParams 后 merge 进 execution context，覆盖 LLM 原始值再继续执行。

### 6. Agent Core 侧适配

**Ajv 校验前归一化**（在 `coerceMergedTypes` 附近）：
```typescript
function normalizeEnumForValidation(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) =>
    typeof item === 'string' ? item : item.value
  );
}

// 在 compile schema 前
if (config.parameterContract?.properties) {
  for (const [, prop] of Object.entries(config.parameterContract.properties)) {
    if ((prop as any).enum) {
      (prop as any).enum = normalizeEnumForValidation((prop as any).enum);
    }
  }
}
```

**SKILL GENERATOR describe 更新**：`parameterContract` 的 describe 补充说明 `enumSource` 字段和 `enum` 的双格式。

### 7. SKILL GENERATOR 全面支持

**选择**：SKILL GENERATOR 的 `parameterContract` schema describe 向 LLM 说明新字段，使 LLM 能生成含 `enumSource` 的 Skill 配置。

**`parameterContract` describe 更新**：
```
parameterContract: JSON Schema object. Each property in 'properties' supports:
- type/description/required/default: standard JSON Schema
- enum: ["a","b"] (simple) OR [{"label":"展示名","value":"a"}] (with display labels)
- enumSource (optional): for dynamic options fetched from an API. Fields:
  { url, method(default "GET"), headers, jsonPath, valueKey(default "value"),
    labelKey(default "label"), searchParam, refreshIntervalSec(default 300) }
```

**`properties` 子属性的 describe 更新**：
```
Each property in parameterContract.properties:
- type: "string"|"number"|"boolean"
- description: human-readable field description (used as form label)
- enum: string[] or [{label:string, value:string}][]
- enumSource: { url, method?, headers?, jsonPath?, valueKey?, labelKey?, searchParam? }
- default: default value when user does not specify
```

### 8. AI 文本优化 — 新增 `api_parameter_contract_enum`

**选择**：新增独立 field_id，专注于优化 `parameterContract` 的 `properties` 内各字段的 `enum`/`enumSource` 配置。与已有 `api_parameter_contract`（全量 JSON 语法修正）互补。

**内置提示词**：

| 字段 | 内容 |
|------|------|
| `fieldId` | `api_parameter_contract_enum` |
| `systemPrompt` | 你是 JSON Schema 专家。修正 parameterContract 的 properties 内字段的 enum/enumSource 配置。enum 支持 string[] 或 [{label,value}]；enumSource 字段只包含 url/method/headers/jsonPath/valueKey/labelKey/searchParam/refreshIntervalSec。只返回严格 JSON：{"optimizedText":"...","explanation":"..."}，optimizedText 必须是合法的 JSON 字符串（只包含 properties 内键值对）。 |
| `userPromptTemplate` | 修正以下 properties 的 enum/enumSource 配置，enum 按场景换成 label/value 格式，需要动态获取的枚举补上 enumSource。\n\n当前文本：\n{{currentText}}\n{{context}} |

**前端集成**：`SkillManagementModal.vue` 参数契约编辑区已有的"✨ AI 优化"按钮旁边新增"✨ AI 优化枚举"按钮，调 `api_parameter_contract_enum`。

**种子数据**：在 `docs/deploy-ddl/003-skill-text-prompts-seed.sql` 新增对应 INSERT 语句。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| `enumSource.url` 不可达或超时 | 下拉框显示空 + loading 超时取消；不影响"取消执行" |
| `enumSource.headers` 含敏感 token | 由 Gateway 发出，前端不可见；审计日志已记录 |
| 存量 `enum: string[]` 在 Ajv 校验时可能误被归一化 | `normalizeEnumForValidation` 仅处理 object 格式，`string[]` 原样返回 |
| `additionalProperties: true` 让格式不正确的 `properties` 逃过校验 | Ajv 仍然校验 type/required/enum 等标准字段，仅放行未知字段如 `enumSource` |

## Migration Plan

1. Gateway 加 `POST /api/skills/enum-source` + SecurityConfig 放通
2. Agent Core 加 `normalizeEnumForValidation` + Ajv schema `additionalProperties: true`
3. 前端新建 `ParameterConfirmModal.vue`
4. 前端 `useChat.ts` 判断 `requiresConfirmation` + `parameterContract` → 弹参数表单
5. 端到端测试：存量 Skill 行为不变，新 Skill 确认时有参数编辑

**回退方案**：不满足条件的 Skill 完全走现有逻辑，零影响。
