<script setup lang="ts">
import { ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { apiUrl } from '../services/config';

const props = defineProps<{
  visible: boolean;
  fieldId: string;
  fieldLabel: string;
  originalText: string;
  context: string;
  userId: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', optimizedText: string): void;
}>();

const isLoading = ref(false);
const optimizedText = ref('');
const explanation = ref('');
const error = ref('');

async function doOptimize() {
  if (!props.originalText.trim()) {
    MessagePlugin.warning('请先输入文本内容');
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    const res = await fetch(apiUrl(`/api/user/${props.userId}/optimize-text`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldId: props.fieldId,
        currentText: props.originalText,
        context: props.context,
      }),
    });

    const data = await res.json();

    if (data.error) {
      error.value = data.hint || data.error;
    } else if (data.optimizedText) {
      optimizedText.value = data.optimizedText;
      explanation.value = data.explanation || '';
    } else {
      error.value = 'AI 优化失败，请重试';
    }
  } catch (e) {
    error.value = '网络请求失败，请检查 Agent Core 服务是否正常';
  } finally {
    isLoading.value = false;
  }
}

function confirmReplace() {
  emit('confirm', optimizedText.value || props.originalText);
  emit('update:visible', false);
}

function cancel() {
  emit('update:visible', false);
}

watch(() => props.visible, (val) => {
  if (val) {
    optimizedText.value = '';
    explanation.value = '';
    error.value = '';
    doOptimize();
  }
});
</script>

<template>
  <t-dialog
    :visible="visible"
    header="AI 文本优化"
    width="760px"
    :confirm-btn="null"
    :cancel-btn="null"
    @close="cancel"
  >
    <div v-if="isLoading" class="optimize-loading">
      <t-loading text="AI 正在优化中..." />
    </div>

    <div v-else-if="error" class="optimize-error">
      <t-alert theme="error" :message="error" />
      <t-space style="margin-top: 16px;">
        <t-button variant="outline" @click="cancel">关闭</t-button>
      </t-space>
    </div>

    <div v-else class="optimize-compare">
      <div class="compare-panels">
        <div class="compare-panel">
          <div class="panel-title">原始文本</div>
          <t-textarea
            :model-value="originalText"
            readonly
            :autosize="{ minRows: 6, maxRows: 14 }"
          />
        </div>
        <div class="compare-panel">
          <div class="panel-title">优化后文本</div>
          <t-textarea
            v-model="optimizedText"
            :autosize="{ minRows: 6, maxRows: 14 }"
          />
        </div>
      </div>

      <div v-if="explanation" class="optimize-explanation">
        <div class="panel-title">优化说明</div>
        <t-alert theme="info" :message="explanation" />
      </div>

      <t-space style="margin-top: 16px;">
        <t-button theme="primary" @click="confirmReplace">确认替换</t-button>
        <t-button variant="outline" @click="cancel">取消</t-button>
      </t-space>
    </div>
  </t-dialog>
</template>

<style scoped>
.optimize-loading {
  padding: 32px 0;
  text-align: center;
}

.compare-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.compare-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.optimize-explanation {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.optimize-error {
  padding: 8px 0;
}
</style>
