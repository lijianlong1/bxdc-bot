<script setup lang="ts">
import { computed } from 'vue';

export interface ConfigSchemaProperty {
  type: string;
  label: string;
  required?: boolean;
  ui: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  placeholder?: string;
  readonly?: boolean;
  aiHint?: string;
  aiOptimize?: { fieldId: string };
  visibleWhen?: { field: string; equals: unknown };
}

export interface ConfigSchema {
  type: string;
  properties: Record<string, ConfigSchemaProperty>;
}

const props = defineProps<{
  configSchema: ConfigSchema;
  modelValue: Record<string, unknown>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
  optimize: [fieldId: string, fieldLabel: string, currentValue: string];
}>();

const properties = computed(() => {
  return Object.entries(props.configSchema.properties ?? {}).filter(([, prop]) => {
    if (!prop.visibleWhen) return true;
    const currentValue = props.modelValue[prop.visibleWhen.field]
      ?? props.configSchema.properties[prop.visibleWhen.field]?.default;
    return currentValue === prop.visibleWhen.equals;
  });
});

function getFieldValue(key: string): unknown {
  return props.modelValue[key] ?? props.configSchema.properties[key]?.default ?? '';
}

function setFieldValue(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      return value;
    }
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function parseJsonValue(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function handleJsonChange(key: string, text: string) {
  const parsed = parseJsonValue(text);
  emit('update:modelValue', { ...props.modelValue, [key]: parsed });
}

function handleOptimize(key: string) {
  const prop = props.configSchema.properties[key];
  const fieldId = prop?.aiOptimize?.fieldId ?? key;
  const fieldLabel = prop?.label ?? key;
  const value = props.modelValue[key];
  const currentText = typeof value === 'string'
    ? value
    : formatJsonValue(value ?? '');
  emit('optimize', fieldId, fieldLabel, currentText);
}
</script>

<template>
  <t-form-item
    v-for="[key, prop] in properties"
    :key="key"
    :name="key"
    :rules="prop.required ? [{ validator: (val: unknown) => { const v = val; return v !== undefined && v !== null && String(v).trim() !== ''; }, message: `${prop.label}不能为空` }] : undefined"
  >
    <template #label>
      <div v-if="prop.ui !== 'checkbox'" class="form-label-wrap">
        <span class="form-label-text">
          <span v-if="prop.required" class="form-label-required">*</span>
          {{ prop.label }}
        </span>
        <span v-if="prop.aiHint" class="form-label-hint">{{ prop.aiHint }}</span>
      </div>
    </template>

    <t-input
      v-if="prop.ui === 'input'"
      :model-value="String(getFieldValue(key) ?? '')"
      :placeholder="prop.placeholder"
      :readonly="prop.readonly"
      @change="(val: string) => setFieldValue(key, val)"
    />

    <t-select
      v-else-if="prop.ui === 'select'"
      :model-value="String(getFieldValue(key) ?? '')"
      :options="(prop.enum ?? []).map(v => ({ value: v, label: v }))"
      @change="(val: string) => setFieldValue(key, val)"
    />

    <t-checkbox
      v-else-if="prop.ui === 'checkbox'"
      :model-value="Boolean(getFieldValue(key) ?? prop.default ?? false)"
      @change="(val: boolean) => setFieldValue(key, val)"
    >
      {{ prop.label }}
    </t-checkbox>

    <div v-else-if="prop.ui === 'radio'">
      <t-radio-group
        :model-value="String(getFieldValue(key) ?? prop.default ?? '')"
        @change="(val: string) => setFieldValue(key, val)"
      >
        <t-radio
          v-for="opt in (prop.enum ?? [])"
          :key="opt"
          :value="opt"
        >
          {{ opt === 'SINGLE_CALL' ? '单次长调用（无需 pollEndpoint，提交后立即返回，长 readTimeout 等结果）' : opt === 'PERIODIC' ? '周期轮询（需要提供状态查询端点 + {id} 占位符）' : opt }}
        </t-radio>
      </t-radio-group>
    </div>

    <t-input-number
      v-else-if="prop.ui === 'number'"
      :model-value="Number(getFieldValue(key) ?? prop.default ?? 0)"
      :min="prop.minimum"
      :max="prop.maximum"
      @change="(val: number) => setFieldValue(key, val)"
    />

    <div v-else-if="prop.ui === 'textarea' || prop.ui === 'jsonEditor' || prop.ui === 'keyValue'" class="optimize-textarea-wrap">
      <t-textarea
        :model-value="prop.ui === 'jsonEditor' || prop.ui === 'keyValue' ? formatJsonValue(getFieldValue(key)) : String(getFieldValue(key) ?? '')"
        :placeholder="prop.placeholder"
        :autosize="{ minRows: 3, maxRows: 8 }"
        @change="(val: string) => prop.ui === 'jsonEditor' || prop.ui === 'keyValue' ? handleJsonChange(key, val) : setFieldValue(key, val)"
      />
      <t-button
        v-if="prop.aiOptimize"
        size="small"
        variant="text"
        class="optimize-btn"
        @click="handleOptimize(key)"
      >
        ✨ AI 优化
      </t-button>
    </div>

    <t-input
      v-else
      :model-value="String(getFieldValue(key) ?? '')"
      :placeholder="prop.placeholder"
      @change="(val: string) => setFieldValue(key, val)"
    />
  </t-form-item>
</template>

<style scoped>
.optimize-textarea-wrap {
  position: relative;
  width: 100%;
}

.optimize-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  z-index: 1;
}

.form-label-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.form-label-text {
  font-size: 14px;
  line-height: 22px;
  color: var(--td-text-color-primary);
}

.form-label-required {
  color: var(--td-error-color, #e34d59);
  margin-right: 2px;
}

.form-label-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--td-text-color-placeholder);
  font-weight: 400;
}
</style>
