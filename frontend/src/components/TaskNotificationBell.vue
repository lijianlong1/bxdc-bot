<script setup lang="ts">
import { ref } from 'vue'
import { useAsyncTaskNotifications, type AsyncTaskNotification } from '../composables/useAsyncTaskNotifications'
import { fmtShortTime, fmtFullTime } from '../utils/datetime'

const {
  unreadCount,
  tasks,
  loading,
  drawerVisible,
  loadTasks,
  acknowledge,
  deleteTask,
  batchDelete,
  openDrawer,
  closeDrawer,
} = useAsyncTaskNotifications()

function statusColor(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'PENDING': return 'default'
    case 'POLLING': return 'primary'
    case 'SINGLE_CALLED': return 'primary'
    case 'COMPLETED': return 'success'
    case 'FAILED': return 'danger'
    case 'TIMEOUT': return 'warning'
    default: return 'default'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING': return '等待中'
    case 'POLLING': return '轮询中'
    case 'SINGLE_CALLED': return '单次调用中'
    case 'COMPLETED': return '已完成'
    case 'FAILED': return '失败'
    case 'TIMEOUT': return '超时'
    default: return status
  }
}

function pollStrategyLabel(ps: string | null | undefined): string {
  switch (ps) {
    case 'PERIODIC': return '周期轮询'
    case 'SINGLE_CALL': return '单次长调用'
    default: return '周期轮询'
  }
}

function fmtTime(s: string | null): string {
  return fmtShortTime(s)
}

function durationLabel(t: AsyncTaskNotification): string {
  if (t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'TIMEOUT') {
    if (t.startedAt && t.completedAt) {
      const ms = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()
      const sec = Math.max(0, Math.floor(ms / 1000))
      if (sec < 60) return `${sec}s`
      if (sec < 3600) return `${Math.floor(sec / 60)}m${sec % 60}s`
      return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`
    }
    return ''
  }
  // 进行中：基于 elapsedSeconds
  const sec = Math.max(0, t.elapsedSeconds || 0)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m${sec % 60}s`
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`
}

function progressPercent(t: AsyncTaskNotification): number {
  if (t.status === 'COMPLETED') return 100
  if (t.status === 'FAILED' || t.status === 'TIMEOUT') return 100
  if (t.status === 'POLLING' || t.status === 'SINGLE_CALLED') {
    // 粗略估算：基于 elapsed vs maxWait，超出则 99%
    const max = 1800 // 默认最长 30 分钟
    return Math.min(99, Math.floor(((t.elapsedSeconds || 0) / max) * 100))
  }
  if (t.status === 'PENDING') return 5
  return 0
}

function progressStatus(t: AsyncTaskNotification): 'success' | 'error' | 'active' | 'undefined' {
  if (t.status === 'COMPLETED') return 'success'
  if (t.status === 'FAILED' || t.status === 'TIMEOUT') return 'error'
  return 'active'
}

function fmtDetailTime(s: string | null): string {
  return fmtFullTime(s)
}

// 批量选择模式 + 选中集合
const batchMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())

// 详情弹窗
const detailVisible = ref(false)
const detailTask = ref<AsyncTaskNotification | null>(null)

function toggleSelect(taskId: number) {
  if (selectedIds.value.has(taskId)) {
    selectedIds.value.delete(taskId)
  } else {
    selectedIds.value.add(taskId)
  }
}

function toggleSelectAll() {
  if (selectedIds.value.size === tasks.value.length) {
    selectedIds.value.clear()
  } else {
    selectedIds.value = new Set(tasks.value.map(t => t.id))
  }
}

function enterBatchMode() {
  batchMode.value = true
  selectedIds.value.clear()
}

function exitBatchMode() {
  batchMode.value = false
  selectedIds.value.clear()
}

async function handleBatchDelete() {
  if (selectedIds.value.size === 0) return
  const ids: number[] = Array.from(selectedIds.value)
  const ok = confirm(`确定删除选中的 ${ids.length} 条任务通知？此操作不可恢复。`)
  if (!ok) return
  const affected = await batchDelete(ids)
  selectedIds.value.clear()
  if (affected > 0) {
    batchMode.value = false
  }
}

async function handleSingleDelete(t: AsyncTaskNotification) {
  const ok = confirm(`确定删除任务 #${t.id}（${t.skillName || '异步任务'}）？此操作不可恢复。`)
  if (!ok) return
  await deleteTask(t.id)
  selectedIds.value.delete(t.id)
}

function handleViewDetail(t: AsyncTaskNotification) {
  // 标记已读
  if (t.unread) {
    void acknowledge(t.id)
  }
  detailTask.value = t
  detailVisible.value = true
}

function handleCloseDetail() {
  detailVisible.value = false
  detailTask.value = null
}

async function handleOpen() {
  openDrawer()
  // 打开抽屉时退出批量模式
  batchMode.value = false
  selectedIds.value.clear()
  // 立即拉一次
  await loadTasks(false, 50)
}

function handleClose() {
  closeDrawer()
  batchMode.value = false
  selectedIds.value.clear()
}
</script>

<template>
  <div class="task-notification-bell">
    <t-badge :count="unreadCount" :max-count="99" :show-zero="false" :offset="[-4, 4]">
      <t-button
        theme="default"
        variant="text"
        aria-label="任务通知"
        @click="handleOpen"
      >
        消息
      </t-button>
    </t-badge>

    <t-drawer
      v-model:visible="drawerVisible"
      header="异步任务通知"
      size="medium"
      :footer="false"
      @close="handleClose"
    >
      <div class="task-notification-content">
        <div class="header-hint">
          <span class="hint-text">仅显示长时间执行的异步任务（asyncPoll 配置）。同步秒回任务不会出现在这里。</span>
        </div>
        <t-loading v-if="loading && tasks.length === 0" text="加载中..." />
        <t-empty v-else-if="tasks.length === 0" description="暂无任务通知" />
        <div v-if="batchMode" class="batch-toolbar">
          <t-checkbox
            :checked="selectedIds.size === tasks.length && tasks.length > 0"
            :indeterminate="selectedIds.size > 0 && selectedIds.size < tasks.length"
            @change="toggleSelectAll"
          >
            全选 ({{ selectedIds.size }}/{{ tasks.length }})
          </t-checkbox>
          <div class="batch-actions">
            <t-button
              theme="danger"
              size="small"
              variant="text"
              :disabled="selectedIds.size === 0"
              @click="handleBatchDelete"
            >
              批量删除
            </t-button>
            <t-button theme="default" size="small" variant="text" @click="exitBatchMode">
              取消
            </t-button>
          </div>
        </div>
        <div v-else class="list-toolbar">
          <t-button theme="default" size="small" variant="text" @click="enterBatchMode">
            批量管理
          </t-button>
        </div>

        <ul v-if="tasks.length > 0" class="task-list">
          <li
            v-for="t in tasks"
            :key="t.id"
            class="task-item"
            :class="{ 'is-unread': t.unread, 'is-selected': selectedIds.has(t.id) }"
          >
            <div class="task-item-main">
              <t-checkbox
                v-if="batchMode"
                :checked="selectedIds.has(t.id)"
                @change="toggleSelect(t.id)"
              />
              <div class="task-item-content" @click="batchMode ? toggleSelect(t.id) : handleViewDetail(t)">
                <div class="task-item-header">
                  <div class="task-item-title">
                    <span class="skill-name">{{ t.skillName || '异步任务' }}</span>
                    <t-tag :theme="statusColor(t.status)" size="small">{{ statusLabel(t.status) }}</t-tag>
                    <span v-if="t.unread" class="unread-dot" aria-label="未读">●</span>
                  </div>
                  <div class="task-item-meta">
                    <span class="meta-time">{{ fmtTime(t.startedAt || t.createdAt) }}</span>
                    <span class="meta-duration">耗时 {{ durationLabel(t) }}</span>
                  </div>
                </div>

                <t-progress
                  v-if="t.status === 'POLLING' || t.status === 'PENDING' || t.status === 'SINGLE_CALLED' || t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'TIMEOUT'"
                  :percentage="progressPercent(t)"
                  :status="progressStatus(t)"
                  :stroke-width="3"
                  class="task-progress"
                />

                <div v-if="t.status === 'FAILED' && t.errorMessage" class="task-error">
                  <span class="error-label">错误：</span>{{ t.errorMessage }}
                </div>

                <div v-else-if="t.status === 'COMPLETED' && t.previewResult" class="task-preview">
                  {{ t.previewResult }}
                </div>

                <div v-else-if="t.externalTaskId" class="task-external">
                  外部任务 ID: {{ t.externalTaskId }}
                </div>
              </div>
            </div>

            <div v-if="!batchMode" class="task-item-actions">
              <t-button theme="primary" size="small" variant="text" @click="handleViewDetail(t)">
                查看
              </t-button>
              <t-button theme="danger" size="small" variant="text" @click="handleSingleDelete(t)">
                删除
              </t-button>
            </div>
          </li>
        </ul>
      </div>
    </t-drawer>

    <t-dialog
      v-model:visible="detailVisible"
      :header="detailTask ? `任务详情 #${detailTask.id}` : '任务详情'"
      :footer="false"
      width="640px"
      @close="handleCloseDetail"
    >
      <div v-if="detailTask" class="task-detail">
        <div class="detail-row">
          <span class="detail-label">任务 ID：</span>
          <span class="detail-value">#{{ detailTask.id }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">技能：</span>
          <span class="detail-value">{{ detailTask.skillName || '异步任务' }} <span v-if="detailTask.skillId" class="muted">(id: {{ detailTask.skillId }})</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">状态：</span>
          <t-tag :theme="statusColor(detailTask.status)" size="small">{{ statusLabel(detailTask.status) }}</t-tag>
          <span v-if="detailTask.unread" class="unread-dot" aria-label="未读">● 未读</span>
        </div>
        <div v-if="detailTask.externalTaskId" class="detail-row">
          <span class="detail-label">外部任务 ID：</span>
          <span class="detail-value mono">{{ detailTask.externalTaskId }}</span>
        </div>
        <div v-if="detailTask.sessionId" class="detail-row">
          <span class="detail-label">会话 ID：</span>
          <span class="detail-value mono">{{ detailTask.sessionId }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">轮询策略：</span>
          <span class="detail-value">{{ pollStrategyLabel(detailTask.pollStrategy) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">重试次数：</span>
          <span class="detail-value">{{ detailTask.retryCount }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">已耗时：</span>
          <span class="detail-value">{{ durationLabel(detailTask) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">开始时间：</span>
          <span class="detail-value mono">{{ fmtDetailTime(detailTask.startedAt) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">创建时间：</span>
          <span class="detail-value mono">{{ fmtDetailTime(detailTask.createdAt) }}</span>
        </div>
        <div v-if="detailTask.completedAt" class="detail-row">
          <span class="detail-label">完成时间：</span>
          <span class="detail-value mono">{{ fmtDetailTime(detailTask.completedAt) }}</span>
        </div>

        <t-progress
          v-if="detailTask.status === 'POLLING' || detailTask.status === 'PENDING' || detailTask.status === 'SINGLE_CALLED'"
          :percentage="progressPercent(detailTask)"
          :status="progressStatus(detailTask)"
          :stroke-width="4"
          class="detail-progress"
        />

        <div v-if="detailTask.status === 'FAILED' && detailTask.errorMessage" class="detail-block detail-block-error">
          <div class="detail-block-title">错误信息</div>
          <pre class="detail-block-content">{{ detailTask.errorMessage }}</pre>
        </div>

        <div v-if="detailTask.previewResult" class="detail-block">
          <div class="detail-block-title">结果摘要</div>
          <pre class="detail-block-content">{{ detailTask.previewResult }}</pre>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<style scoped>
.task-notification-bell {
  display: inline-flex;
  align-items: center;
}

.task-notification-content {
  padding: 0 4px;
}

.header-hint {
  padding: 0 0 12px 0;
  border-bottom: 1px solid var(--td-component-stroke);
  margin-bottom: 12px;
}

.hint-text {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  line-height: 1.5;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  padding: 12px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
  background: var(--td-bg-color-container);
  transition: all 0.2s ease;
}

.task-item.is-unread {
  border-left: 3px solid var(--td-brand-color);
  background: var(--td-brand-color-light);
}

.task-item-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.task-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-name {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.unread-dot {
  color: var(--td-error-color);
  font-size: 12px;
  margin-left: auto;
}

.task-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.task-progress {
  margin: 6px 0 8px 0;
}

.task-error,
.task-preview,
.task-external {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-top: 6px;
  word-break: break-word;
}

.task-error {
  color: var(--td-error-color);
}

.list-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px 8px 4px;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 10px;
  background: var(--td-brand-color-light);
  border: 1px solid var(--td-brand-color);
  border-radius: 6px;
}

.batch-actions {
  display: flex;
  gap: 4px;
}

.task-item-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.task-item-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.task-item-actions {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.task-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.detail-label {
  color: var(--td-text-color-secondary);
  min-width: 80px;
}

.detail-value {
  color: var(--td-text-color-primary);
}

.detail-value.mono {
  font-family: var(--td-font-family-mono);
  word-break: break-all;
}

.muted {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}

.detail-progress {
  margin: 12px 0;
}

.detail-block {
  margin-top: 12px;
  padding: 12px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 6px;
}

.detail-block-error {
  background: var(--td-error-color-light);
}

.detail-block-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
  margin-bottom: 6px;
}

.detail-block-content {
  font-size: 12px;
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
  margin: 0;
  font-family: var(--td-font-family-mono);
}
</style>
