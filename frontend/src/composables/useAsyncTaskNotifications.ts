import { ref, computed } from 'vue'
import { useUser } from './useUser'
import { apiUrl } from '../services/config'

/**
 * 异步任务通知 composable。
 * 单例：跨组件共享 unreadCount / tasks / polling state。
 *
 * 行为：
 * - 启动后每 30s 轮询 /api/async-tasks/my/unread-count
 * - 拉取列表时调用 /api/async-tasks/my
 * - markRead 调用 POST /api/async-tasks/{id}/ack
 */
export interface AsyncTaskNotification {
  id: number
  skillId: number | null
  skillName: string | null
  externalTaskId: string | null
  sessionId: string | null
  status: 'PENDING' | 'POLLING' | 'SINGLE_CALLED' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | string
  pollStrategy: 'PERIODIC' | 'SINGLE_CALL' | null
  retryCount: number
  elapsedSeconds: number
  pollResponseCount: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string | null
  notifiedAt: string | null
  unread: boolean
  previewResult: string | null
}

let _instance: ReturnType<typeof createInstance> | null = null

function createInstance() {
  const { currentUser } = useUser()

  const unreadCount = ref(0)
  const tasks = ref<AsyncTaskNotification[]>([])
  const loading = ref(false)
  const drawerVisible = ref(false)

  let pollTimer: number | null = null

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (currentUser.value?.id) h['X-User-Id'] = currentUser.value.id
    return h
  }

  async function fetchUnreadCount(): Promise<void> {
    if (!currentUser.value?.id) {
      unreadCount.value = 0
      return
    }
    try {
      const res = await fetch(apiUrl('/api/async-tasks/my/unread-count'), {
        method: 'GET',
        headers: authHeaders(),
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json()
      unreadCount.value = Number(data.count) || 0
    } catch {
      // 静默失败，不影响其他功能
    }
  }

  async function loadTasks(unreadOnly = false, limit = 20): Promise<void> {
    if (!currentUser.value?.id) {
      tasks.value = []
      return
    }
    loading.value = true
    try {
      const params = new URLSearchParams({
        unreadOnly: String(unreadOnly),
        limit: String(limit),
      })
      const res = await fetch(`${apiUrl('/api/async-tasks/my')}?${params.toString()}`, {
        method: 'GET',
        headers: authHeaders(),
        credentials: 'include',
      })
      if (!res.ok) {
        tasks.value = []
        return
      }
      const data = await res.json()
      tasks.value = Array.isArray(data.items) ? data.items : []
      // 列表加载后重新同步未读数
      unreadCount.value = tasks.value.filter(t => t.unread).length
    } catch {
      tasks.value = []
    } finally {
      loading.value = false
    }
  }

  async function acknowledge(taskId: number): Promise<boolean> {
    if (!currentUser.value?.id) return false
    try {
      const res = await fetch(apiUrl(`/api/async-tasks/${taskId}/ack`), {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
      })
      if (!res.ok) return false
      const data = await res.json()
      const ok = !!data.ok
      if (ok) {
        // 本地更新 unread 状态
        const idx = tasks.value.findIndex(t => t.id === taskId)
        if (idx >= 0) {
          const t = tasks.value[idx]!
          t.unread = false
          t.notifiedAt = new Date().toISOString()
        }
        // 重新计算未读数
        const newUnread = tasks.value.filter(t => t.unread).length
        if (newUnread < unreadCount.value) unreadCount.value = newUnread
      }
      return ok
    } catch {
      return false
    }
  }

  /**
   * 删除单条任务。后端仅允许删除属于自己的任务。
   * 成功后从本地列表中移除。
   */
  async function deleteTask(taskId: number): Promise<boolean> {
    if (!currentUser.value?.id) return false
    try {
      const res = await fetch(apiUrl(`/api/async-tasks/${taskId}`), {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      })
      if (!res.ok) return false
      const data = await res.json()
      const ok = !!data.ok
      if (ok) {
        const removed = tasks.value.find(t => t.id === taskId)
        tasks.value = tasks.value.filter(t => t.id !== taskId)
        if (removed?.unread) {
          const newUnread = tasks.value.filter(t => t.unread).length
          if (newUnread < unreadCount.value) unreadCount.value = newUnread
        }
      }
      return ok
    } catch {
      return false
    }
  }

  /**
   * 批量删除任务。
   * 返回后端实际删除的条数。
   */
  async function batchDelete(taskIds: number[]): Promise<number> {
    if (!currentUser.value?.id || taskIds.length === 0) return 0
    try {
      const res = await fetch(apiUrl('/api/async-tasks/batch-delete'), {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids: taskIds }),
      })
      if (!res.ok) return 0
      const data = await res.json()
      const affected = Number(data.affected) || 0
      // 本地移除被删除的（按后端返回的 affected 数）
      const removed = tasks.value.filter(t => taskIds.includes(t.id))
      const hadUnread = removed.some(t => t.unread)
      tasks.value = tasks.value.filter(t => !taskIds.includes(t.id))
      if (hadUnread) {
        const newUnread = tasks.value.filter(t => t.unread).length
        if (newUnread < unreadCount.value) unreadCount.value = newUnread
      }
      return affected
    } catch {
      return 0
    }
  }

  function openDrawer(): void {
    drawerVisible.value = true
    loadTasks(false, 50)
  }

  function closeDrawer(): void {
    drawerVisible.value = false
  }

  function startPolling(intervalMs = 30_000): void {
    stopPolling()
    // 立即拉一次
    fetchUnreadCount()
    pollTimer = window.setInterval(fetchUnreadCount, intervalMs)
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    unreadCount: computed(() => unreadCount.value),
    tasks: computed(() => tasks.value),
    loading: computed(() => loading.value),
    drawerVisible: computed(() => drawerVisible.value),
    fetchUnreadCount,
    loadTasks,
    acknowledge,
    deleteTask,
    batchDelete,
    openDrawer,
    closeDrawer,
    startPolling,
    stopPolling,
  }
}

export function useAsyncTaskNotifications() {
  if (!_instance) {
    _instance = createInstance()
  }
  return _instance
}
