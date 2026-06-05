<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { Chat as TChat, ChatContent as TChatContent } from '@tdesign-vue-next/chat'
import { useChat, type LlmLogEntry, type Message, type ToolInvocation, type ConfirmationRequest, type PollingStatus } from '../composables/useChat'
import { useUser } from '../composables/useUser'
import { useSkillHub } from '../composables/useSkillHub'
import { useThinkingMode } from '../composables/useThinkingMode'
import UserAvatar from './UserAvatar.vue'
import ThinkingMode from './ThinkingMode.vue'
import { ChevronUpIcon, ChevronDownIcon, DownloadIcon, RefreshIcon, CopyIcon, ThumbUpIcon, ThumbDownIcon, Share1Icon } from 'tdesign-icons-vue-next'
import { apiUrl } from '../services/config'
import { downloadMarkdown, downloadPdf } from '../utils/chatDownload'
import { MessagePlugin } from 'tdesign-vue-next'

const { messages, isThinking, confirmSkillAction, updateConfirmationArguments } = useChat()
const { currentUser } = useUser()
const { skills, fetchSkills } = useSkillHub()
const { getSession } = useThinkingMode()
const activeLogMessageId = ref<string | null>(null)
const expandedPollingKeys = ref(new Set<string>())
const downloadLoading = ref(false)

// 从通知中心跳转标记：进入页面时显示一个"已从通知进入"的 banner，几秒后自动消失
const showFromNotificationBanner = ref(false)
const fromNotificationTaskId = ref<string | null>(null)
try {
  const pending = sessionStorage.getItem('pendingTaskId')
  if (pending) {
    fromNotificationTaskId.value = pending
    showFromNotificationBanner.value = true
    sessionStorage.removeItem('pendingTaskId')
    setTimeout(() => { showFromNotificationBanner.value = false }, 6000)
  }
} catch {
  // ignore
}

onMounted(() => { fetchSkills() })

function formatToolStatus(status: 'running' | 'completed' | 'failed') {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '调用失败'
  return '调用中'
}

function formatPollingStatus(ps: PollingStatus): string {
  if (ps.status === 'COMPLETED') return '轮询结束'
  if (ps.status === 'FAILED' || ps.status === 'TIMEOUT') return '轮询错误'
  const count = ps.pollResponses.length
  if (count === 0) return '等待首次轮询'
  return `轮询第${count}次`
}

function formatToolSummary(summary?: string) {
  if (!summary) return ''
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary
}

function formatToolArguments(args?: unknown) {
  if (args == null) return ''
  const raw = typeof args === 'string' ? args : JSON.stringify(args)
  if (!raw) return ''
  return raw
}

/** Tool 返回正文（SSE `result`），在消息区与日志区展示 */
function formatToolResultText(result?: string) {
  if (result == null || String(result).length === 0) return ''
  return String(result)
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function togglePollingResponse(key: string) {
  const next = new Set(expandedPollingKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  expandedPollingKeys.value = next
}

function formatLogTime(timestamp: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function formatLogDirection(direction: 'request' | 'response') {
  return direction === 'request' ? '请求参数' : '响应内容'
}

function stringifyLogPayload(payload: unknown) {
  return JSON.stringify(payload ?? {}, null, 2)
}

function openLogViewer(messageId: string) {
  activeLogMessageId.value = messageId
}

function handleLogDialogVisibilityChange(visible: boolean) {
  if (!visible) {
    activeLogMessageId.value = null
  }
}

function closeLogViewer() {
  activeLogMessageId.value = null
}

function openLatestLogViewer() {
  if (latestAssistantMessage.value) {
    activeLogMessageId.value = latestAssistantMessage.value.id
  }
}

const activeLogMessage = computed(() =>
  (messages?.value ?? []).find((message) => message.id === activeLogMessageId.value) ?? null,
)

type LogViewerRow =
  | { key: string; variant: 'tool'; tool: ToolInvocation }
  | { key: string; variant: 'tool-child'; parent: ToolInvocation; child: ToolInvocation }
  | { key: string; variant: 'llm'; entry: LlmLogEntry }

function findToolInvocationSlot(
  tools: ToolInvocation[],
  id: string,
):
  | { variant: 'tool'; tool: ToolInvocation }
  | { variant: 'tool-child'; parent: ToolInvocation; child: ToolInvocation }
  | null {
  for (const t of tools) {
    if (t.id === id) return { variant: 'tool', tool: t }
    for (const c of t.children ?? []) {
      if (c.id === id) return { variant: 'tool-child', parent: t, child: c }
    }
  }
  return null
}

function buildFallbackLogTimeline(message: Message) {
  const tools = message.toolInvocations ?? []
  const logs = message.llmLogs ?? []
  const entries: { kind: 'tool' | 'llm'; id: string }[] = []
  for (const t of tools) {
    entries.push({ kind: 'tool', id: t.id })
    for (const c of t.children ?? []) {
      entries.push({ kind: 'tool', id: c.id })
    }
  }
  for (const e of [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )) {
    entries.push({ kind: 'llm', id: e.id })
  }
  return entries
}

const logViewerRows = computed<LogViewerRow[]>(() => {
  const msg = activeLogMessage.value
  if (!msg) return []
  const tools = msg.toolInvocations ?? []
  const logs = msg.llmLogs ?? []
  const timeline =
    msg.logTimeline && msg.logTimeline.length > 0
      ? msg.logTimeline
      : buildFallbackLogTimeline(msg)

  const rows: LogViewerRow[] = []
  for (const step of timeline) {
    if (step.kind === 'llm') {
      const entry = logs.find((e) => e.id === step.id)
      if (entry) rows.push({ key: entry.id, variant: 'llm', entry })
      continue
    }
    const found = findToolInvocationSlot(tools, step.id)
    if (!found) continue
    if (found.variant === 'tool') {
      rows.push({ key: `tool-${found.tool.id}`, variant: 'tool', tool: found.tool })
    } else {
      rows.push({
        key: `tool-${found.child.id}`,
        variant: 'tool-child',
        parent: found.parent,
        child: found.child,
      })
    }
  }
  return rows
})

const expandedLogs = ref<Set<string>>(new Set())

function toggleLogExpand(id: string) {
  if (expandedLogs.value.has(id)) {
    expandedLogs.value.delete(id)
  } else {
    expandedLogs.value.add(id)
  }
}

function expandAllLogs() {
  const ids = new Set<string>()
  logViewerRows.value.forEach((row) => ids.add(row.key))
  expandedLogs.value = ids
}

function collapseAllLogs() {
  expandedLogs.value.clear()
}

const latestAssistantMessage = computed(() =>
  [...(messages?.value ?? [])].reverse().find((message) => message.role === 'assistant') ?? null,
)

const latestAssistantLogCount = computed(() => latestAssistantMessage.value?.llmLogs?.length ?? 0)

function normalizeEnumOptions(raw: unknown[]): { label: string; value: unknown }[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  if (typeof raw[0] === 'string') return raw.map(v => ({ label: String(v), value: v }))
  if (typeof raw[0] === 'number') return raw.map(v => ({ label: String(v), value: v }))
  if (typeof raw[0] === 'boolean') return raw.map(v => ({ label: String(v), value: v }))
  return raw as { label: string; value: unknown }[]
}

function resolveParamProperties(config: any): Record<string, any> | null {
  if (!config) return null
  const pc = config.parameterContract
  if (!pc) return null
  if (pc.properties && typeof pc.properties === 'object' && !Array.isArray(pc.properties)) {
    const keys = Object.keys(pc.properties)
    if (keys.length > 0) return pc.properties
  }
  const entries = Object.entries(pc)
  const hasSchemaProps = entries.some(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && 'type' in (v as any))
  if (hasSchemaProps) {
    const out: Record<string, any> = {}
    for (const [k, v] of entries) {
      if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = v
    }
    return Object.keys(out).length > 0 ? out : null
  }
  return null
}

const formStates = reactive<Record<string, {
  values: Record<string, unknown>
  properties: Record<string, any> | null
  rawJson: string
  optionsCache: Record<string, { label: string; value: unknown }[]>
  loading: Record<string, boolean>
}>>({})

function getOrInitFormState(conf: ConfirmationRequest) {
  const existing = formStates[conf.toolCallId]
  if (existing && existing.properties !== null) return existing

  let skill = skills.value.find(s =>
    s.name === conf.skillName
    || s.name === conf.skillName.replace(/_/g, '-')
    || s.name === conf.skillName.replace(/-/g, '_')
  )

  if (!skill && existing) return existing

  if (!skill) {
    if (!existing) {
      formStates[conf.toolCallId] = {
        values: reactive({}),
        properties: null,
        rawJson: formatConfirmationArguments(conf.arguments),
        optionsCache: reactive({}),
        loading: reactive({}),
      }
    }
    return formStates[conf.toolCallId]
  }
  let properties: Record<string, any> | null = null
  if (skill) {
    try {
      let config = typeof skill.configuration === 'string' ? JSON.parse(skill.configuration) : skill.configuration
      if (config && typeof config.parameterContract === 'string') {
        try { config = { ...config, parameterContract: JSON.parse(config.parameterContract) } } catch { /* keep as-is */ }
      }
      properties = resolveParamProperties(config)
      console.log(`[skill] formState INIT: toolCallId=${conf.toolCallId} skillName=${conf.skillName}`, {
        propKeys: properties ? Object.keys(properties) : null,
      })
    } catch (e) { console.error(`[skill] formState INIT error: toolCallId=${conf.toolCallId}`, e); }
  }

  const llmArgs = (conf.arguments as Record<string, unknown>) || {}
  let values: Record<string, unknown> = {}
  if (properties) {
    for (const [key, prop] of Object.entries(properties)) {
      if (key in llmArgs && llmArgs[key] !== undefined && llmArgs[key] !== null) {
        values[key] = llmArgs[key]
      } else if ((prop as any).default !== undefined) {
        values[key] = (prop as any).default
      } else {
        values[key] = ''
      }
    }
  }

  formStates[conf.toolCallId] = {
    values: reactive(values),
    properties,
    rawJson: formatConfirmationArguments(conf.arguments),
    optionsCache: reactive({}),
    loading: reactive({}),
  }

  if (properties) {
    for (const [key, prop] of Object.entries(properties)) {
      if ((prop as any).enumSource) fetchEnumSource(conf.toolCallId, key, prop)
    }
  }

  return formStates[conf.toolCallId]
}

async function fetchEnumSource(toolCallId: string, key: string, prop: Record<string, unknown>, searchQuery = '') {
  const state = formStates[toolCallId]
  if (!state) return
  state.loading[key] = true
  try {
    const body = JSON.stringify({ ...(prop.enumSource as Record<string, unknown>), searchQuery })
    const res = await fetch(apiUrl('/api/skills/enum-source'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) {
      state.optionsCache[key] = await res.json()
      console.log(`[skill] enumSource OK: toolCallId=${toolCallId} key=${key} count=${state.optionsCache[key]?.length ?? 0}`)
    } else {
      console.warn(`[skill] enumSource HTTP ${res.status}: toolCallId=${toolCallId} key=${key}`)
      state.optionsCache[key] = []
    }
  } catch (e) {
    console.error(`[skill] enumSource FAILED: toolCallId=${toolCallId} key=${key}`, e)
    state.optionsCache[key] = []
  } finally {
    state.loading[key] = false
  }
}

function normalizeAdjustedParams(
  values: Record<string, unknown>,
  properties: Record<string, any>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(values)) {
    const prop = properties[key]
    if (!prop) { out[key] = val; continue }
    if (prop.type === 'integer' || prop.type === 'number') {
      if (val === '' || val === undefined || val === null) {
        if (prop.default !== undefined) {
          out[key] = prop.default
        }
        continue
      }
      const n = Number(val)
      if (Number.isFinite(n)) {
        out[key] = prop.type === 'integer' ? Math.trunc(n) : n
      } else if (prop.default !== undefined) {
        out[key] = prop.default
      }
    } else if (prop.type === 'boolean') {
      if (typeof val === 'boolean') {
        out[key] = val
      } else if (typeof val === 'string') {
        const lower = val.trim().toLowerCase()
        if (lower === 'true' || lower === '1') out[key] = true
        else if (lower === 'false' || lower === '0' || lower === '') out[key] = false
        else if (prop.default !== undefined) out[key] = prop.default
      }
    } else {
      out[key] = val
    }
  }
  return out
}

function handleConfirmation(toolCallId: string, confirmed: boolean) {
  if (confirmed) {
    const formState = formStates[toolCallId]
    if (formState) {
      let adjustedParams: Record<string, unknown>
      if (formState.properties) {
        const rawValues = { ...formState.values }
        adjustedParams = normalizeAdjustedParams(formState.values, formState.properties)
        console.log(`[skill] confirm BUTTON params: toolCallId=${toolCallId}`, {
          rawValues,
          adjustedParams,
        })
      } else {
        try {
          adjustedParams = JSON.parse(formState.rawJson)
        } catch {
          adjustedParams = {}
        }
        console.log(`[skill] confirm BUTTON (raw JSON): toolCallId=${toolCallId}`, {
          rawJson: formState.rawJson.slice(0, 300),
          adjustedParams,
        })
      }
      updateConfirmationArguments(toolCallId, adjustedParams)
      confirmSkillAction(toolCallId, true, adjustedParams)
      return
    }
  }
  confirmSkillAction(toolCallId, confirmed)
}

function formatConfirmationArguments(args?: unknown): string {
  if (args === undefined || args === null) return ''
  if (typeof args === 'string') return args.trim() ? args : ''
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

function hasConfirmationArguments(args?: unknown): boolean {
  if (args === undefined || args === null) return false
  if (typeof args === 'string') return args.trim().length > 0
  if (Array.isArray(args)) return args.length > 0
  if (typeof args === 'object') return Object.keys(args as object).length > 0
  return true
}

function confirmationHeaderTitle(conf: ConfirmationRequest): string {
  if (conf.status === 'pending') return '需要确认执行'
  if (conf.status === 'cancelled') return '已取消'
  if (conf.status === 'expired') return '已过期'
  if (conf.status === 'confirmed') {
    if (conf.executionOutcome === 'completed') return '执行已完成'
    if (conf.executionOutcome === 'failed') return '执行失败'
    return '已确认'
  }
  return ''
}

function confirmationBadgeText(conf: ConfirmationRequest): string {
  if (conf.status !== 'confirmed') return ''
  if (conf.executionOutcome === 'completed') return '执行已完成'
  if (conf.executionOutcome === 'failed') return '执行失败'
  return '已确认，执行中...'
}

function confirmationCardClass(conf: ConfirmationRequest): string {
  const base = `confirmation-card--${conf.status}`
  if (conf.status !== 'confirmed') return base
  if (conf.executionOutcome === 'completed') return `${base} confirmation-card--done`
  if (conf.executionOutcome === 'failed') return `${base} confirmation-card--error`
  return base
}

function confirmationBadgeClass(conf: ConfirmationRequest): string {
  if (conf.executionOutcome === 'completed') return 'confirmation-badge--done'
  if (conf.executionOutcome === 'failed') return 'confirmation-badge--failed'
  return 'confirmation-badge--confirmed'
}

const chatItems = computed(() =>
  (messages?.value ?? []).map((message, index, list) => ({
    id: message.id,
    role: message.role,
    content: [{ type: 'text', text: message.content }],
    rawContent: message.content,
    confirmations: message.confirmations ?? [],
    toolInvocations: message.toolInvocations ?? [],
    llmLogs: message.llmLogs ?? [],
    sessionId: message.sessionId,
    showThinking: message.role === 'assistant' && isThinking.value && index === list.length - 1,
    isLast: index === list.length - 1,
    name: message.role === 'assistant' ? 'BXDC.bot' : '你',
    datetime: formatTime(message.timestamp),
    avatarEmoji: message.role === 'assistant' ? '🤖' : (currentUser.value?.avatar || '👤'),
  } as any)),
)

async function handleDownload(format: 'md' | 'pdf', msg: Message) {
  downloadLoading.value = true
  try {
    if (format === 'md') {
      downloadMarkdown(msg)
    } else {
      await downloadPdf(msg)
    }
  } catch (e) {
    console.error('Download failed:', e)
    MessagePlugin.error('下载失败，请重试')
  } finally {
    downloadLoading.value = false
  }
}

async function copyContent(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    MessagePlugin.success('已复制到剪贴板')
  } catch {
    MessagePlugin.error('复制失败')
  }
}
</script>

<template>
  <div class="message-list">
    <div v-if="latestAssistantMessage" class="message-list-toolbar">
      <t-button size="small" variant="outline" @click="openLatestLogViewer">
        日志查看
      </t-button>
      <span class="message-list-toolbar-text">
        {{ latestAssistantLogCount > 0 ? `当前回复 ${latestAssistantLogCount} 条日志` : '当前回复暂无日志' }}
      </span>
    </div>

    <div
      v-if="chatItems.length === 0 && !isThinking"
      class="empty-state"
    >
      <span class="empty-hint">开始与 BXDC.bot 对话</span>
    </div>

    <template v-else>
      <transition name="banner-fade">
        <div v-if="showFromNotificationBanner" class="from-notification-banner">
          <span class="banner-icon">消息</span>
          <span class="banner-text">
            已从任务通知进入
            <span v-if="fromNotificationTaskId" class="banner-task-id">#{{ fromNotificationTaskId }}</span>
          </span>
        </div>
      </transition>

      <TChat
      class="chat-panel"
      :data="chatItems"
      layout="both"
      :auto-scroll="true"
      default-scroll-to="bottom"
      :show-scroll-button="true"
      :clear-history="false"
      :is-stream-load="true"
      :text-loading="false"
      :animation="'moving'"
    >
      <template #avatar="{ item }">
        <div class="chat-avatar-slot">
          <UserAvatar
            :avatar="item.avatarEmoji"
            :size="24"
            :variant="item.role === 'assistant' ? 'chatAssistant' : 'chatUser'"
          />
        </div>
      </template>

      <template #content="{ item }">
        <div class="message-content-block">
          <!-- 思考模式组件：始终只用 ThinkingMode，不再显示老的小思考框 -->
          <ThinkingMode
            v-if="item.sessionId && getSession(item.sessionId)"
            :nodes="getSession(item.sessionId)?.nodes || []"
            :is-active="getSession(item.sessionId)?.isActive || false"
          />

          <!-- 兜底：未进入 ThinkingMode session 时，构造一个初始 session 触发显示 -->
          <ThinkingMode
            v-else-if="item.showThinking"
            :nodes="[]"
            :is-active="true"
          />

          <div class="content-wrapper">
            <TChatContent
              :role="item.role"
              :content="
                item.role === 'assistant'
                  ? { type: 'markdown', data: item.rawContent || '' }
                  : item.rawContent || ''
              "
            />
            <span
              v-if="item.role === 'assistant' && isThinking && item.isLast && item.rawContent"
              class="typewriter-cursor"
            />
          </div>

          <div
            v-for="conf in item.confirmations"
            :key="conf.toolCallId"
            class="confirmation-card"
            :class="confirmationCardClass(conf)"
          >
            <div class="confirmation-header">
              <span class="confirmation-title">{{ confirmationHeaderTitle(conf) }}</span>
            </div>
            <div class="confirmation-body">
              <p><strong>技能：</strong>{{ conf.skillName }}</p>
              <p><strong>操作：</strong>{{ conf.summary }}</p>
              <p v-if="conf.details"><strong>详情：</strong>{{ conf.details }}</p>
              <!-- pending + has arguments → always editable -->
              <template v-if="conf.status === 'pending' && hasConfirmationArguments(conf.arguments)">
                <div class="confirmation-params">
                  <div class="confirmation-params-label">执行参数（可修改）</div>
                  <!-- has parameterContract → typed fields -->
                  <template v-if="getOrInitFormState(conf)?.properties">
                    <div v-for="(prop, key) in getOrInitFormState(conf)!.properties!" :key="key" class="confirmation-inline-field">
                      <label>{{ (prop as any).description || key }}</label>
                      <t-select v-if="(prop as any).enum" v-model="getOrInitFormState(conf)!.values[key]" :options="normalizeEnumOptions((prop as any).enum)" filterable size="small" />
                      <t-select v-else-if="(prop as any).enumSource" v-model="getOrInitFormState(conf)!.values[key]" :options="(getOrInitFormState(conf)!.optionsCache[key] || []) as any" :loading="getOrInitFormState(conf)!.loading[key]" filterable remote :remote-method="(kw: string) => fetchEnumSource(conf.toolCallId, key, prop as Record<string, unknown>, kw)" size="small" />
                      <t-input-number v-else-if="(prop as any).type === 'number' || (prop as any).type === 'integer'" v-model="getOrInitFormState(conf)!.values[key]" size="small" />
                      <t-input v-else v-model="getOrInitFormState(conf)!.values[key]" size="small" />
                    </div>
                  </template>
                  <!-- no parameterContract → raw JSON textarea -->
                  <t-textarea v-else v-model="getOrInitFormState(conf)!.rawJson" :autosize="{ minRows: 2, maxRows: 6 }" size="small" />
                </div>
              </template>
              <!-- confirmed/cancelled/expired → plain display -->
              <template v-else>
                <div v-if="hasConfirmationArguments(conf.arguments)" class="confirmation-params">
                  <div class="confirmation-params-label">本次调用参数</div>
                  <pre class="confirmation-params-pre">{{ formatConfirmationArguments(conf.arguments) }}</pre>
                </div>
              </template>
            </div>
            <div v-if="conf.status === 'pending'" class="confirmation-actions">
              <t-button theme="default" variant="outline" @click="handleConfirmation(conf.toolCallId, false)">取消</t-button>
              <t-button theme="primary" @click="handleConfirmation(conf.toolCallId, true)">确认执行</t-button>
            </div>
            <div v-else class="confirmation-status-badge">
              <span
                v-if="conf.status === 'confirmed'"
                class="confirmation-badge"
                :class="confirmationBadgeClass(conf)"
              >{{ confirmationBadgeText(conf) }}</span>
              <span v-else-if="conf.status === 'cancelled'" class="confirmation-badge confirmation-badge--cancelled">已取消</span>
              <span v-else class="confirmation-badge confirmation-badge--expired">已过期</span>
            </div>
          </div>

          <div
            v-if="item.role === 'assistant' && item.toolInvocations.length"
            class="tool-status-list"
          >
            <div
              v-for="tool in item.toolInvocations"
              :key="tool.id"
              class="tool-status-item"
              :class="`tool-status-item--${tool.status}`"
            >
              <div class="tool-status-main">
                <span class="tool-status-name">{{ tool.displayName }}</span>
                <t-tag
                  v-if="tool.executionLabel"
                  size="small"
                  variant="light"
                  :theme="tool.executionMode === 'OPENCLAW' ? 'warning' : 'primary'"
                >
                  {{ tool.executionLabel }}
                </t-tag>
                <span class="tool-status-separator">·</span>
                <span class="tool-status-text">{{ formatToolStatus(tool.status) }}</span>
                <span v-if="tool.status === 'completed'" class="tool-status-check">✓</span>
              </div>
              <div v-if="tool.pollingStatus" class="tool-polling-status">
                <div class="tool-polling-header" @click="togglePollingResponse(tool.id)">
                  <span class="tool-polling-arrow">{{ expandedPollingKeys.has(tool.id) ? '▼' : '▶' }}</span>
                  <t-tag size="small" theme="warning" variant="light">
                    {{ formatPollingStatus(tool.pollingStatus) }}
                  </t-tag>
                  <span v-if="tool.pollingStatus.elapsedSeconds > 0" class="tool-polling-elapsed">⏱ {{ formatElapsed(tool.pollingStatus.elapsedSeconds) }}</span>
                  <span v-if="tool.pollingStatus.pollResponses.length" class="tool-polling-count">{{ tool.pollingStatus.pollResponses.length }} 次响应</span>
                </div>
                <div v-if="expandedPollingKeys.has(tool.id) && tool.pollingStatus.pollResponses.length" class="tool-polling-responses">
                  <div
                    v-for="(resp, idx) in tool.pollingStatus.pollResponses"
                    :key="idx"
                    class="tool-polling-resp-item"
                  >
                    <span class="tool-polling-resp-time">{{ resp.time }}</span>
                    <pre class="tool-polling-resp-body">{{ resp.body }}</pre>
                  </div>
                </div>
              </div>
              <div v-if="tool.arguments !== undefined" class="tool-status-args">
                参数：{{ formatToolArguments(tool.arguments) }}
              </div>
              <div
                v-if="formatToolResultText(tool.result)"
                class="tool-status-result"
              >
                <div class="tool-status-result-label">返回</div>
                <pre class="tool-status-result-body">{{ formatToolResultText(tool.result) }}</pre>
              </div>
              <div v-if="tool.children?.length" class="tool-children-list">
                <div
                  v-for="child in tool.children"
                  :key="child.id"
                  class="tool-child-block"
                >
                  <div
                    class="tool-child-item"
                    :class="`tool-child-item--${child.status}`"
                  >
                    <span class="tool-child-name">{{ child.displayName }}</span>
                    <span class="tool-status-separator">·</span>
                    <span class="tool-status-text">{{ formatToolStatus(child.status) }}</span>
                    <span v-if="child.summary" class="tool-status-separator">·</span>
                    <span v-if="child.summary" class="tool-child-summary">{{ formatToolSummary(child.summary) }}</span>
                    <span v-if="child.arguments !== undefined" class="tool-status-separator">·</span>
                    <span v-if="child.arguments !== undefined" class="tool-child-summary">参数：{{ formatToolArguments(child.arguments) }}</span>
                  </div>
                  <div
                    v-if="formatToolResultText(child.result)"
                    class="tool-child-result"
                  >
                    <pre class="tool-status-result-body">{{ formatToolResultText(child.result) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="item.role === 'assistant' && item.llmLogs.length"
            class="llm-log-actions"
          >
            <t-button size="small" variant="outline" @click="openLogViewer(item.id)">
              日志查看
            </t-button>
            <span class="llm-log-count">共 {{ item.llmLogs.length }} 条</span>
          </div>
        </div>
      </template>

      <template #actions="{ item }">
        <div v-if="item.role === 'assistant' && item.rawContent" class="chat-actions-bar">
          <t-tooltip content="重新生成">
            <t-button theme="default" size="small" variant="text">
              <template #icon><RefreshIcon /></template>
            </t-button>
          </t-tooltip>
          <span class="chat-actions-divider"></span>
          <t-tooltip content="复制">
            <t-button theme="default" size="small" variant="text" @click="copyContent(item.rawContent)">
              <template #icon><CopyIcon /></template>
            </t-button>
          </t-tooltip>
          <t-tooltip content="点赞">
            <t-button theme="default" size="small" variant="text">
              <template #icon><ThumbUpIcon /></template>
            </t-button>
          </t-tooltip>
          <t-tooltip content="踩">
            <t-button theme="default" size="small" variant="text">
              <template #icon><ThumbDownIcon /></template>
            </t-button>
          </t-tooltip>
          <span class="chat-actions-divider"></span>
          <t-tooltip content="分享">
            <t-button theme="default" size="small" variant="text">
              <template #icon><Share1Icon /></template>
            </t-button>
          </t-tooltip>
          <span class="chat-actions-divider"></span>
          <t-dropdown trigger="click" :disabled="downloadLoading">
            <t-tooltip content="下载">
              <t-button theme="default" size="small" variant="text" :loading="downloadLoading">
                <template #icon><DownloadIcon /></template>
              </t-button>
            </t-tooltip>
            <template #dropdown>
              <t-dropdown-menu>
                <t-dropdown-item @click="handleDownload('md', messages?.find(m => m.id === item.id)!)">Markdown (.md)</t-dropdown-item>
                <t-dropdown-item @click="handleDownload('pdf', messages?.find(m => m.id === item.id)!)">PDF (.pdf)</t-dropdown-item>
              </t-dropdown-menu>
            </template>
          </t-dropdown>
        </div>
      </template>
    </TChat>
    </template>

    <t-dialog
      :visible="activeLogMessageId !== null"
      header="调用日志"
      width="880px"
      top="48px"
      :footer="false"
      destroy-on-close
      @update:visible="handleLogDialogVisibilityChange"
      @close="closeLogViewer"
    >
      <div class="llm-log-viewer">
        <div class="llm-log-toolbar">
          <t-space>
            <t-button size="small" variant="text" @click="expandAllLogs">展开全部</t-button>
            <t-button size="small" variant="text" @click="collapseAllLogs">收起全部</t-button>
          </t-space>
        </div>
        <div v-if="logViewerRows.length === 0" class="llm-log-empty">
          当前消息暂无可展示的日志
        </div>
        <div v-else class="llm-log-list">
          <template v-for="row in logViewerRows" :key="row.key">
            <div
              v-if="row.variant === 'tool'"
              class="llm-log-item llm-log-item--tool"
            >
              <div class="llm-log-header" @click="toggleLogExpand(row.key)" style="cursor: pointer;">
                <div class="llm-log-meta">
                  <t-tag theme="warning" variant="light">Tool</t-tag>
                  <span class="llm-log-summary">{{ row.tool.displayName }} ({{ row.tool.name }})</span>
                  <span class="tool-status-text" :class="`tool-status-item--${row.tool.status}`">{{ formatToolStatus(row.tool.status) }}</span>
                </div>
                <div class="llm-log-header-right">
                  <span v-if="activeLogMessage" class="llm-log-time">{{ formatTime(activeLogMessage.timestamp) }}</span>
                  <t-button variant="text" shape="square" size="small">
                    <component :is="expandedLogs.has(row.key) ? ChevronUpIcon : ChevronDownIcon" />
                  </t-button>
                </div>
              </div>

              <div v-show="expandedLogs.has(row.key)">
                <div class="llm-log-section">
                  <div class="llm-log-section-title">调用参数</div>
                  <pre class="llm-log-payload">{{ stringifyLogPayload(row.tool.arguments) }}</pre>
                </div>
                <div
                  v-if="row.tool.result != null && String(row.tool.result).length > 0"
                  class="llm-log-section"
                >
                  <div class="llm-log-section-title">返回内容</div>
                  <pre class="llm-log-payload">{{ row.tool.result }}</pre>
                </div>
              </div>
            </div>

            <div
              v-else-if="row.variant === 'tool-child'"
              class="llm-log-item llm-log-item--tool-child"
            >
              <div class="llm-log-header" @click="toggleLogExpand(row.key)" style="cursor: pointer;">
                <div class="llm-log-meta">
                  <t-tag theme="warning" variant="outline">SubTool</t-tag>
                  <span class="llm-log-summary">{{ row.child.displayName }} ({{ row.child.name }})</span>
                  <span class="tool-status-text" :class="`tool-child-item--${row.child.status}`">{{ formatToolStatus(row.child.status) }}</span>
                </div>
                <div class="llm-log-header-right">
                  <span v-if="activeLogMessage" class="llm-log-time">{{ formatTime(activeLogMessage.timestamp) }}</span>
                  <t-button variant="text" shape="square" size="small">
                    <component :is="expandedLogs.has(row.key) ? ChevronUpIcon : ChevronDownIcon" />
                  </t-button>
                </div>
              </div>
              <div v-show="expandedLogs.has(row.key)">
                <div class="llm-log-section">
                  <div class="llm-log-section-title">调用参数</div>
                  <pre class="llm-log-payload">{{ stringifyLogPayload(row.child.arguments) }}</pre>
                </div>
                <div
                  v-if="row.child.result != null && String(row.child.result).length > 0"
                  class="llm-log-section"
                >
                  <div class="llm-log-section-title">返回内容</div>
                  <pre class="llm-log-payload">{{ row.child.result }}</pre>
                </div>
              </div>
            </div>

            <div
              v-else
              class="llm-log-item"
              :class="`llm-log-item--${row.entry.direction}`"
            >
              <div class="llm-log-header" @click="toggleLogExpand(row.key)" style="cursor: pointer;">
                <div class="llm-log-meta">
                  <t-tag :theme="row.entry.direction === 'request' ? 'primary' : 'success'" variant="light">
                    {{ formatLogDirection(row.entry.direction) }}
                  </t-tag>
                  <span class="llm-log-summary">{{ row.entry.summary }}</span>
                </div>
                <div class="llm-log-header-right">
                  <span class="llm-log-time">{{ formatLogTime(row.entry.timestamp) }}</span>
                  <t-button variant="text" shape="square" size="small">
                    <component :is="expandedLogs.has(row.key) ? ChevronUpIcon : ChevronDownIcon" />
                  </t-button>
                </div>
              </div>

              <div v-show="expandedLogs.has(row.key)">
                <div v-if="row.entry.modelName" class="llm-log-model">
                  模型：{{ row.entry.modelName }}
                </div>

                <div class="llm-log-section">
                  <div class="llm-log-section-title">
                    {{ row.entry.direction === 'request' ? '送给大模型的参数' : '大模型返回的内容' }}
                  </div>
                  <pre class="llm-log-payload">{{ stringifyLogPayload(row.entry.direction === 'request' ? row.entry.request : row.entry.response) }}</pre>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  min-height: 0;
  padding: 16px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 768px) {
  .message-list {
    padding: 24px 24px 8px;
  }
}

.chat-panel {
  flex: 1;
  min-height: 0;
}

.message-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.message-list-toolbar-text {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.message-content-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-status-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
}

.tool-status-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  align-self: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--td-text-color-secondary);
}

.tool-status-args {
  max-width: 560px;
  color: var(--td-text-color-placeholder);
  word-break: break-all;
}

.tool-status-result {
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
}

.tool-status-result-label {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.tool-status-result-body {
  margin: 0;
  padding: 6px 8px;
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.35;
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.tool-child-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  width: 100%;
}

.tool-child-result {
  margin-left: 0;
  width: 100%;
  max-width: 520px;
}

.tool-status-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tool-status-item--running {
  color: var(--td-brand-color);
}

.tool-status-item--failed {
  color: var(--td-error-color);
}

.tool-status-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-children-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 14px;
  padding-left: 10px;
  border-left: 2px solid var(--td-component-stroke);
}

.tool-child-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--td-text-color-secondary);
}

.tool-child-item--running {
  color: var(--td-brand-color);
}

.tool-child-item--failed {
  color: var(--td-error-color);
}

.tool-child-name,
.tool-child-summary {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-status-separator {
  opacity: 0.65;
}

.tool-status-check {
  color: var(--td-success-color);
  font-weight: 700;
}

.tool-polling-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.tool-polling-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.tool-polling-arrow {
  font-size: 10px;
  color: var(--td-text-color-placeholder);
  width: 12px;
  flex-shrink: 0;
}

.tool-polling-elapsed {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.tool-polling-count {
  font-size: 11px;
  color: var(--td-text-color-secondary);
}

.tool-polling-responses {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.tool-polling-resp-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.tool-polling-resp-time {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
  padding-top: 6px;
  min-width: 56px;
}

.tool-polling-resp-body {
  margin: 0;
  flex: 1;
  padding: 6px 8px;
  background: var(--td-bg-color-container);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 80px;
  overflow-y: auto;
}

.llm-log-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
}

.llm-log-count {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.llm-log-viewer {
  max-height: min(70vh, 720px);
  overflow: auto;
}

.llm-log-empty {
  color: var(--td-text-color-placeholder);
}

.llm-log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.llm-log-item {
  border: 1px solid var(--td-border-level-2-color);
  border-radius: var(--td-radius-medium);
  padding: 12px;
  background: var(--td-bg-color-container);
}

.llm-log-item--request {
  border-left: 4px solid var(--td-brand-color);
}

.llm-log-item--response {
  border-left: 4px solid var(--td-success-color);
}

.llm-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.llm-log-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.llm-log-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.llm-log-item--tool {
  border-left: 4px solid var(--td-warning-color);
}

.tool-children-logs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  margin-left: 16px;
  padding-left: 12px;
  border-left: 2px solid var(--td-component-stroke);
}

.llm-log-item--tool-child {
  border-left: none;
  background: var(--td-bg-color-page);
}

.llm-log-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.llm-log-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.llm-log-time,
.llm-log-model {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.llm-log-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.llm-log-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--td-text-color-secondary);
}

.llm-log-payload {
  margin: 0;
  padding: 12px;
  overflow: auto;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-page);
  color: var(--td-text-color-primary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 320px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.empty-hint {
  font-size: 14px;
  color: var(--td-text-color-placeholder);
}

.from-notification-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  margin: 0 12px 8px 12px;
  background: linear-gradient(90deg, var(--td-brand-color-light), transparent);
  border-left: 3px solid var(--td-brand-color);
  border-radius: 4px;
  font-size: 13px;
  color: var(--td-text-color-primary);
}

.banner-icon {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--td-brand-color);
  background: var(--td-brand-color-light);
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.banner-task-id {
  margin-left: 4px;
  color: var(--td-text-color-placeholder);
  font-family: var(--td-font-family-mono);
  font-size: 12px;
}

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 槽位：横向比头像略宽以留白；纵向与昵称顶对齐（TChat 已在 .t-chat__avatar 上设 padding-top 与 content--base 一致，勿再垂直居中把头像顶下去） */
.chat-avatar-slot {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  min-width: 40px;
  min-height: 24px;
  box-sizing: border-box;
}

:deep(.t-chat) {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  height: 100% !important;
}

:deep(.t-chat__list) {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

:deep(.t-chat__inner) {
  display: flex !important;
  align-items: flex-start;
}

/* TChat 在 avatar 外包一层 __avatar / __avatar__box；原先写死 24×24 会压扁槽位，导致留白无效 */
:deep(.t-chat__avatar) {
  overflow: visible !important;
  flex-shrink: 0;
  align-self: flex-start;
}

:deep(.t-chat__avatar__box) {
  overflow: visible !important;
  border-radius: 8px !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  width: 40px !important;
  height: auto !important;
  min-width: 40px;
  min-height: 24px;
  padding: 0 !important;
  display: flex !important;
  align-items: flex-start;
  justify-content: center;
}

:deep(.t-chat__content) {
  border-radius: var(--td-radius-large);
  box-sizing: border-box;
  min-width: 0;
}

/* 昵称与时间不要紧贴气泡正文 */
:deep(.t-chat__base) {
  margin-bottom: 6px;
}

:deep(.t-chat__list) {
  padding-right: 8px;
  padding-bottom: 12px;
}

:deep(.t-chat__item) {
  margin-bottom: 20px;
}

:deep(.t-chat__content-markdown pre) {
  border-radius: var(--td-radius-medium);
}

@keyframes thinkingBob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-3px) rotate(-6deg) scale(1.02);
  }
  50% {
    transform: translateY(-5px) rotate(-10deg) scale(1.04);
  }
  75% {
    transform: translateY(-3px) rotate(-4deg) scale(1.02);
  }
}

@keyframes thinkingPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(0, 82, 217, 0.06);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 6px 24px 2px rgba(0, 82, 217, 0.12);
    transform: scale(1.01);
  }
}

@keyframes thinkingWave {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateX(280%);
    opacity: 0;
  }
}

/* 打字机效果 - 闪烁光标 */
.typewriter-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background-color: var(--td-brand-color);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: typewriterCursor 0.8s ease-in-out infinite;
}

@keyframes typewriterCursor {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* 流式内容容器 */
.streaming-content {
  position: relative;
}

/* 打字机效果 - 淡入动画 */
.typewriter-content {
  animation: typewriterFadeIn 0.15s ease-out forwards;
}

@keyframes typewriterFadeIn {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

/* 流式加载中的内容包装器 */
.content-wrapper {
  position: relative;
  display: inline;
}

.confirmation-card {
  margin-top: 8px;
  border: 1px solid var(--td-border-level-2-color);
  border-radius: var(--td-radius-medium);
  background-color: var(--td-bg-color-container);
  overflow: hidden;
  max-width: 420px;
}

.confirmation-card--confirmed {
  border-color: var(--td-success-color-3);
}

.confirmation-card--cancelled,
.confirmation-card--expired {
  opacity: 0.7;
}

.confirmation-header {
  padding: 8px 12px;
  background-color: var(--td-warning-color-1);
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.confirmation-card--confirmed .confirmation-header {
  background-color: var(--td-success-color-1);
}

.confirmation-card--cancelled .confirmation-header,
.confirmation-card--expired .confirmation-header {
  background-color: var(--td-bg-color-secondarycontainer);
}

.confirmation-title {
  font-weight: 600;
  color: var(--td-warning-color-6);
  font-size: 14px;
}

.confirmation-card--confirmed .confirmation-title {
  color: var(--td-success-color-6);
}

.confirmation-card--done .confirmation-title {
  color: var(--td-success-color-6);
}

.confirmation-card--error .confirmation-title {
  color: var(--td-error-color-6);
}

.confirmation-card--cancelled .confirmation-title,
.confirmation-card--expired .confirmation-title {
  color: var(--td-text-color-secondary);
}

.confirmation-body {
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.confirmation-body p {
  margin: 0 0 6px 0;
}

.confirmation-body p:last-child {
  margin-bottom: 0;
}

.confirmation-params {
  margin-top: 8px;
}

.confirmation-params-label {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--td-text-color-primary);
}

.confirmation-params-pre {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 6px;
  border: 1px solid var(--td-border-level-1-color);
  max-height: 220px;
  overflow: auto;
}

.confirmation-inline-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.confirmation-inline-field label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.confirmation-actions {
  padding: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.confirmation-status-badge {
  padding: 8px 12px;
  border-top: 1px solid var(--td-border-level-1-color);
  text-align: center;
}

.confirmation-badge {
  font-size: 12px;
  font-weight: 600;
}

.confirmation-badge--confirmed {
  color: var(--td-success-color);
}

.confirmation-badge--done {
  color: var(--td-success-color);
}

.confirmation-badge--failed {
  color: var(--td-error-color);
}

.confirmation-badge--cancelled {
  color: var(--td-text-color-placeholder);
}

.confirmation-badge--expired {
  color: var(--td-text-color-placeholder);
}

/* 自定义操作栏，与 TDesign t-chat__actions 样式一致 */
.chat-actions-bar {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  margin-top: var(--td-comp-margin-xs);
  background-color: var(--td-bg-color-secondarycontainer);
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-2-color);
  gap: 0;
}
.chat-actions-bar .t-button {
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-xs);
  width: var(--td-comp-size-xxxs);
  height: var(--td-comp-size-xxxs);
  box-sizing: content-box;
  color: var(--td-text-color-primary);
  background-color: transparent;
  border: 0;
  margin-right: var(--td-comp-margin-xs);
}
.chat-actions-bar .t-button .t-icon {
  font-size: var(--td-font-size-body-large);
}
.chat-actions-bar .t-button:hover {
  background-color: var(--td-bg-color-secondarycontainer-hover);
}
.chat-actions-divider {
  width: 1px;
  height: var(--td-comp-size-xxxs);
  background-color: var(--td-component-stroke);
  margin-right: var(--td-comp-margin-xs);
}
</style>
