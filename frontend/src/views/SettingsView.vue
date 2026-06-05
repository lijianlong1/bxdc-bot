<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUser } from '../composables/useUser';
import { useRouter } from 'vue-router';
import Card from '../components/ui/Card.vue';
import Button from '../components/ui/Button.vue';
import Input from '../components/ui/Input.vue';

const { currentUser, fetchLlmSettings, saveLlmSettings } = useUser();
const router = useRouter();

const apiBase = ref('');
const modelName = ref('');
const apiKey = ref('');
const hasStoredKey = ref(false);
const loading = ref(false);
const saving = ref(false);
const message = ref('');

onMounted(async () => {
  if (!currentUser.value) {
    router.replace('/login');
    return;
  }
  loading.value = true;
  try {
    const s = await fetchLlmSettings(currentUser.value.id);
    apiBase.value = s.apiBase || '';
    modelName.value = s.modelName || '';
    hasStoredKey.value = s.hasApiKey;
    apiKey.value = '';
    message.value = '';
  } catch (e) {
    message.value = '加载失败';
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  if (!currentUser.value) return;
  saving.value = true;
  message.value = '';
  try {
    const payload: { apiBase: string; modelName: string; apiKey?: string } = {
      apiBase: apiBase.value.trim(),
      modelName: modelName.value.trim(),
    };
    if (apiKey.value.trim()) {
      payload.apiKey = apiKey.value.trim();
    }
    await saveLlmSettings(currentUser.value.id, payload);
    hasStoredKey.value = true;
    apiKey.value = '';
    message.value = '已保存';
  } catch (e: any) {
    message.value = e?.message || '保存失败';
  } finally {
    saving.value = false;
  }
}

async function clearStoredKey() {
  if (!currentUser.value) return;
  saving.value = true;
  try {
    await saveLlmSettings(currentUser.value.id, {
      apiBase: apiBase.value.trim(),
      modelName: modelName.value.trim(),
      apiKey: '',
    });
    hasStoredKey.value = false;
    message.value = '已清除保存的 API Key';
  } catch (e: any) {
    message.value = e?.message || '操作失败';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="settings-page">
    <Card class="settings-card" title="大模型连接" description="兼容 OpenAI API 的地址与模型。密钥仅保存在服务端，不会在界面回显。">
      <div v-if="loading" class="muted">加载中…</div>
      <form v-else class="settings-form" @submit.prevent="handleSave">
        <Input v-model="apiBase" label="API Base URL" placeholder="https://api.openai.com/v1" />
        <Input v-model="modelName" label="模型名称" placeholder="gpt-4o-mini" />
        <Input v-model="apiKey" label="API Key" type="password" placeholder="留空则不修改已保存的密钥" autocomplete="off" />
        <p v-if="hasStoredKey" class="hint">当前已保存 API Key（仅显示状态，不回显明文）</p>
        <div v-if="message" class="msg">{{ message }}</div>
        <div class="actions">
          <Button type="submit" variant="primary" :loading="saving">保存</Button>
          <Button v-if="hasStoredKey" type="button" variant="secondary" :loading="saving" @click="clearStoredKey">
            清除已存密钥
          </Button>
          <Button type="button" variant="ghost" @click="router.push('/')">返回聊天</Button>
        </div>
      </form>
    </Card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 520px;
  margin: 0 auto;
  padding: 24px 16px;
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hint {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  margin: 0;
}
.msg {
  font-size: 14px;
  color: var(--td-success-color);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.muted {
  color: var(--td-text-color-secondary);
}
</style>
