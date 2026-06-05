<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useUser } from '../composables/useUser';
import { useSkillHub } from '../composables/useSkillHub';
import { useServerLedger } from '../composables/useServerLedger';
import { useAsyncTaskNotifications } from '../composables/useAsyncTaskNotifications';
import UserAvatar from './UserAvatar.vue';
import ProfileEditModal from './ProfileEditModal.vue';
import SkillHub from './SkillHub.vue';
import ServerLedger from './ServerLedger.vue';
import TaskNotificationBell from './TaskNotificationBell.vue';
import { AppIcon, ServerIcon } from 'tdesign-icons-vue-next';

const router = useRouter();
const { currentUser, logout } = useUser();
const profileEditVisible = ref(false);
const { toggleSkillHub } = useSkillHub();
const { toggleServerLedger } = useServerLedger();
const { startPolling, stopPolling } = useAsyncTaskNotifications();

onMounted(() => {
  // 启动异步任务通知 30s 轮询
  startPolling(30_000);
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<template>
  <t-layout class="app-layout">
    <t-header class="layout-header">
      <div class="layout-header__content">
        <div class="layout-brand">
          <div class="layout-title">BXDC.bot</div>
          <div class="layout-subtitle">AI Chat</div>
        </div>
        
        <div style="flex: 1"></div>

        <div class="layout-actions">
          <t-button theme="default" variant="text" @click="toggleServerLedger" v-if="currentUser">
            <template #icon><ServerIcon /></template>
            Servers
          </t-button>
          <t-button theme="default" variant="text" @click="toggleSkillHub">
            <template #icon><AppIcon /></template>
            SkillHub
          </t-button>
          <t-button v-if="currentUser" theme="default" variant="text" @click="router.push('/settings')">
            大模型设置
          </t-button>
          <t-button v-if="currentUser" theme="default" variant="text" @click="profileEditVisible = true">
            编辑资料
          </t-button>

          <TaskNotificationBell v-if="currentUser" />

          <div class="user-info" v-if="currentUser">
            <UserAvatar :avatar="currentUser.avatar" :size="32" />
            <span class="user-name">{{ currentUser.nickname }}</span>
          </div>
          <t-button v-if="currentUser" theme="default" variant="text" @click="logout">Switch User</t-button>
        </div>
      </div>
    </t-header>
    <t-content class="layout-content">
      <div class="layout-content-inner">
        <slot />
      </div>
    </t-content>
    <SkillHub />
    <ServerLedger />
    <ProfileEditModal v-model:visible="profileEditVisible" />
  </t-layout>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: var(--td-bg-color-page);
}

.layout-header {
  flex-shrink: 0;
  background: transparent;
  padding: 16px 16px 12px;
}

.layout-header__content {
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
}

@media (min-width: 768px) {
  .layout-header {
    padding: 24px 24px 12px;
  }
}

.layout-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.layout-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.layout-subtitle {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.layout-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

.layout-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
}

.layout-content :deep(.t-content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.layout-content-inner {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

@media (min-width: 768px) {
  .layout-content {
    padding: 0 24px 24px;
  }
}
</style>
