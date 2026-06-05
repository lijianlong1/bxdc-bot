<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUser } from '../composables/useUser';
import Button from '../components/ui/Button.vue';
import Input from '../components/ui/Input.vue';
import Card from '../components/ui/Card.vue';
import { apiUrl } from '../services/config';
import { AVATAR_EMOJI_CHOICES } from '../constants/avatarEmojiChoices';
import UserAvatar from '../components/UserAvatar.vue';

const userId = ref('');
const nickname = ref('');
const systemAdminPassword = ref('');
const error = ref('');
const loading = ref(false);
const { register, updateAvatar, fetchLlmSettings } = useUser();
const router = useRouter();

const step = ref<'form' | 'complete'>('form');
const selectedEmoji = ref('👤');
const canAiAvatar = ref(false);
const aiLoading = ref(false);

async function handleRegister() {
  error.value = '';
  loading.value = true;
  try {
    const user = await register(userId.value, nickname.value, systemAdminPassword.value, false);

    if (!user) {
      throw new Error('注册失败');
    }

    await updateAvatar(user.id, selectedEmoji.value);

    try {
      const s = await fetchLlmSettings(user.id);
      canAiAvatar.value = s.hasEffectiveApiKey;
    } catch {
      canAiAvatar.value = false;
    }

    step.value = 'complete';
  } catch (e: any) {
    error.value = e.message || '注册失败';
  } finally {
    loading.value = false;
  }
}

async function tryAiAvatar() {
  const uid = userId.value.trim();
  const nn = nickname.value.trim();
  if (!uid || !nn) return;
  aiLoading.value = true;
  try {
    const res = await fetch(apiUrl(`/api/user/${uid}/avatar/generate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nn }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = (data as { error?: string }).error || '生成失败';
      return;
    }
    const avatar = (data as { avatar?: string }).avatar || '👤';
    selectedEmoji.value = avatar;
    await updateAvatar(uid, avatar);
    error.value = '';
  } catch (e: any) {
    error.value = e?.message || '生成失败';
  } finally {
    aiLoading.value = false;
  }
}

function goToChat() {
  router.push('/');
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <Card v-if="step === 'form'" class="w-full max-w-md shadow-lg border-0" title="创建账户" description="选择头像（可稍后在大模型设置中配置 API 以使用 AI 推荐头像）">
      <form @submit.prevent="handleRegister" class="space-y-6">
        <Input
          v-model="userId"
          label="用户 ID"
          placeholder="6 位数字 (例如 123456)"
          :error="error && error.includes('ID') ? error : undefined"
          :disabled="loading"
        />

        <Input
          v-model="nickname"
          label="昵称"
          placeholder="我们该如何称呼您？"
          :disabled="loading"
        />

        <Input
          v-model="systemAdminPassword"
          type="password"
          label="系统管理员密码"
          placeholder="由管理员提供的注册授权"
          :disabled="loading"
        />

        <div>
          <label class="text-sm font-medium text-slate-700">头像（点选 emoji）</label>
          <div class="emoji-grid">
            <button
              v-for="em in AVATAR_EMOJI_CHOICES"
              :key="em"
              type="button"
              class="emoji-btn"
              :class="{ selected: selectedEmoji === em }"
              @click="selectedEmoji = em"
            >
              <UserAvatar :avatar="em" :size="32" rounded />
            </button>
          </div>
          <p class="text-xs text-slate-500 mt-2">当前：{{ selectedEmoji }}</p>
        </div>

        <div v-if="error && !error.includes('ID')" class="text-sm font-medium text-red-500">
          {{ error }}
        </div>

        <div class="pt-2">
          <Button type="submit" class="w-full" variant="primary" :loading="loading">
            开始使用
          </Button>
        </div>

        <div class="text-center text-sm text-slate-500">
          已有账户？
          <router-link to="/login" class="font-medium text-blue-600 hover:text-blue-500 hover:underline">
            登录
          </router-link>
        </div>
      </form>
    </Card>

    <Card v-else class="w-full max-w-md shadow-lg border-0 text-center py-10" title="准备就绪！">
      <div class="flex flex-col items-center justify-center space-y-6">
        <div
          class="w-32 h-32 rounded-full bg-blue-50 flex items-center justify-center shadow-inner transform transition-transform hover:scale-110 duration-300 p-2 box-border"
        >
          <UserAvatar :avatar="selectedEmoji" :size="112" />
        </div>
        <div class="space-y-2">
          <h3 class="text-xl font-medium text-slate-900">欢迎，{{ nickname }}！</h3>
          <p class="text-slate-500">您的 AI 伙伴正在等待。</p>
        </div>
        <div class="flex flex-col gap-3 w-full max-w-xs">
          <Button
            v-if="canAiAvatar"
            type="button"
            variant="secondary"
            class="w-full"
            :loading="aiLoading"
            @click="tryAiAvatar"
          >
            用 AI 推荐头像
          </Button>
          <p v-else class="text-xs text-slate-400">
            配置 API Key 后可在「设置」中使用 AI 推荐头像；当前也可在聊天中随时修改资料。
          </p>
          <Button type="button" class="w-full" variant="primary" size="lg" @click="goToChat">开始聊天</Button>
        </div>
        <div v-if="error" class="text-sm text-red-500">{{ error }}</div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
  max-height: calc(40px * 3.5 + 8px * 3);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.emoji-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  padding: 4px;
  border-radius: 8px;
  border: 2px solid transparent;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.emoji-btn:hover {
  background: #f1f5f9;
}
.emoji-btn.selected {
  border-color: #2563eb;
  background: #eff6ff;
}
</style>
