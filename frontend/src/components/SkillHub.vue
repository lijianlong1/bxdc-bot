<script setup lang="ts">
import { useSkillHub, BUILT_IN_SKILLS, extendedSkillEmoji, getExecutionModeLabel, getConfigSummary } from '../composables/useSkillHub';
import SkillManagementModal from './SkillManagementModal.vue';
import UserAvatar from './UserAvatar.vue';

const { isSkillHubVisible, skills, isLoading, error, closeSkillHub, openSkillManagement, refreshSkills } = useSkillHub();
</script>

<template>
  <t-drawer
    v-model:visible="isSkillHubVisible"
    header="Skill Hub"
    size="medium"
    :footer="false"
    @close="closeSkillHub"
  >
    <div class="skill-hub-content">
      <div class="section">
        <h3 class="section-title">Built-in Skills</h3>
        <t-list :split="true">
          <t-list-item v-for="skill in BUILT_IN_SKILLS" :key="skill.id">
            <template #action>
              <t-tag theme="primary" variant="light">Built-in</t-tag>
            </template>
            <t-list-item-meta :title="skill.name" :description="skill.description">
              <template #image>
                <UserAvatar
                  :avatar="skill.emoji"
                  :size="32"
                  rounded
                  variant="skillBuiltin"
                />
              </template>
            </t-list-item-meta>
          </t-list-item>
        </t-list>
      </div>

      <div class="section">
        <div class="section-header">
          <h3 class="section-title">Extended Skills</h3>
          <div class="section-actions">
            <t-button size="small" theme="default" variant="outline" @click="refreshSkills">
              刷新
            </t-button>
            <t-button size="small" theme="default" variant="outline" @click="openSkillManagement">
              管理
            </t-button>
          </div>
        </div>
        <div v-if="isLoading" class="loading-state">
          <t-loading text="Loading skills..." />
        </div>
        <div v-else-if="error" class="error-state">
          <t-alert theme="error" :message="error" />
        </div>
        <div v-else-if="skills.length === 0" class="empty-state">
          <p>No extended skills found.</p>
        </div>
        <t-list v-else :split="true">
          <t-list-item v-for="skill in skills" :key="`${skill.id}-${skill.avatar ?? ''}`">
            <template #action>
              <div class="skill-tags">
                <t-tag theme="success" variant="light">Extended</t-tag>
                <t-tag :theme="skill.executionMode === 'OPENCLAW' ? 'warning' : 'primary'" variant="light">
                  {{ getExecutionModeLabel(skill.executionMode) }}
                </t-tag>
                <t-tag v-if="skill.executionMode === 'CONFIG' && getConfigSummary(skill.configuration).kindLabel" theme="default" variant="light">
                  {{ getConfigSummary(skill.configuration).kindLabel }}
                </t-tag>
              </div>
            </template>
            <t-list-item-meta :title="skill.name" :description="skill.description || 'No description provided.'">
              <template #image>
                <UserAvatar
                  :avatar="extendedSkillEmoji(skill)"
                  :size="32"
                  rounded
                  variant="skillExtended"
                />
              </template>
            </t-list-item-meta>
          </t-list-item>
        </t-list>
      </div>
    </div>
  </t-drawer>
  <SkillManagementModal />
</template>

<style scoped>
/* TDesign 默认把 meta 头像包成圆形并 overflow:hidden，导致 Twemoji 被裁成「左上角」 */
.skill-hub-content :deep(.t-list-item__meta) {
  align-items: flex-start;
}

.skill-hub-content :deep(.t-list-item__meta-avatar) {
  width: 32px !important;
  height: 32px !important;
  min-width: 32px;
  min-height: 32px;
  padding: 0 !important;
  /* 与右侧标题/描述留白（与 TDesign meta 布局兼容） */
  margin: 0 12px 0 0 !important;
  border-radius: 6px !important;
  overflow: visible !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  flex-shrink: 0;
}

.skill-hub-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--td-text-color-primary);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.skill-tags {
  display: flex;
  gap: 8px;
}

.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--td-text-color-secondary);
}
</style>
