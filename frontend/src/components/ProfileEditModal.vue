<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUser } from '../composables/useUser';
import { AVATAR_EMOJI_CHOICES } from '../constants/avatarEmojiChoices';
import UserAvatar from './UserAvatar.vue';

const visible = defineModel<boolean>('visible', { default: false });

const { currentUser, updateProfile } = useUser();

const nickname = ref('');
const avatar = ref('👤');
const saving = ref(false);
const error = ref('');

watch(visible, (v) => {
  if (v && currentUser.value) {
    nickname.value = currentUser.value.nickname ?? '';
    avatar.value = currentUser.value.avatar || '👤';
    error.value = '';
  }
});

async function handleSave() {
  const u = currentUser.value;
  if (!u) return;
  saving.value = true;
  error.value = '';
  try {
    await updateProfile(u.id, {
      nickname: nickname.value,
      avatar: avatar.value,
    });
    visible.value = false;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    header="编辑资料"
    width="420px"
    :confirm-btn="null"
    :cancel-btn="null"
    :close-on-overlay-click="!saving"
    :close-on-esc-keydown="!saving"
  >
    <div class="profile-edit">
      <p v-if="currentUser" class="readonly-id">
        用户 ID：<strong>{{ currentUser.id }}</strong>（不可修改）
      </p>
      <div class="preview-row">
        <span class="label">预览</span>
        <UserAvatar :avatar="avatar" :size="48" />
      </div>
      <t-input v-model="nickname" label="昵称" placeholder="1–10 个字符" maxlength="10" />
      <div class="emoji-section">
        <div class="label">头像</div>
        <div class="emoji-grid">
          <button
            v-for="e in AVATAR_EMOJI_CHOICES"
            :key="e"
            type="button"
            class="emoji-btn"
            :class="{ active: avatar === e }"
            @click="avatar = e"
          >
            <UserAvatar :avatar="e" :size="32" rounded />
          </button>
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <template #footer>
      <t-button theme="default" :disabled="saving" @click="visible = false">取消</t-button>
      <t-button theme="primary" :loading="saving" @click="handleSave">保存</t-button>
    </template>
  </t-dialog>
</template>

<style scoped>
.profile-edit {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.readonly-id {
  margin: 0;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.emoji-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  /* 每格 40px 高，约 3.5 行可见（露出半行提示可滚动） */
  max-height: calc(40px * 3.5 + 8px * 3);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.emoji-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--td-component-border);
  border-radius: 8px;
  background: var(--td-bg-color-container);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.emoji-btn:hover {
  border-color: var(--td-brand-color);
}

.emoji-btn.active {
  border-color: var(--td-brand-color);
  box-shadow: 0 0 0 1px var(--td-brand-color);
}

.error {
  margin: 0;
  font-size: 13px;
  color: var(--td-error-color);
}
</style>
