import { ref, provide, inject, type InjectionKey } from 'vue'
import { createTask, getEventSourceUrl, confirmAction } from '../services/api'
import { agentUrl } from '../services/config'
import { useUser } from './useUser'
import { type LlmLogEntry, isLlmLogEvent, mergeLlmLogEntries } from '../utils/llmLog'
import type { UploadFileInfo } from '../types/fileUpload'
import {
  extractArgumentsFromToolCallPayload,
  extractArgumentsFromToolResultMessage,
  mergeToolArgumentsField,
} from '../utils/toolInvocationUtils'

export type ToolInvocationStatus = 'running' | 'completed' | 'failed'

export interface PollResponseEntry {
  time: string
  body: string
}

export interface PollingStatus {
  status: string
  retryCount: number
  elapsedSeconds: number
  pollResponses: PollResponseEntry[]
}

export interface ToolInvocation {
  id: string
  name: string
  displayName: string
  kind: 'skill' | 'tool'
  status: ToolInvocationStatus
  parentId?: string
  parentName?: string
  summary?: string
  arguments?: unknown
  /** Tool function return body (from SSE tool_status), sanitized on server */
  result?: string
  executionMode?: string
  executionLabel?: string
  children?: ToolInvocation[]
  /** Realtime polling progress (from SSE polling_status events) */
  pollingStatus?: PollingStatus
}

export type { LlmLogEntry } from '../utils/llmLog'

export type LogTimelineEntry =
  | { kind: 'tool'; id: string }
  | { kind: 'llm'; id: string }

export type ConfirmationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'

/** After user confirms: running → completed/failed when matching tool_status arrives. */
export type ConfirmationExecutionOutcome = 'running' | 'completed' | 'failed'

export interface ConfirmationRequest {
  sessionId: string
  toolCallId: string
  toolName: string
  skillName: string
  summary: string
  details: string
  arguments?: unknown
  status: ConfirmationStatus
  /** Set when status is `confirmed`; updated when the tool finishes (SSE). */
  executionOutcome?: ConfirmationExecutionOutcome
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** 关联的 agent-core session id（assistant 消息带；用于思考树/确认树定位） */
  sessionId?: string
  toolInvocations?: ToolInvocation[]
  llmLogs?: LlmLogEntry[]
  /** 调用日志弹窗：按 SSE 到达顺序交错 Tool 与 LLM（仅本轮 assistant） */
  logTimeline?: LogTimelineEntry[]
  /** Pending skill confirmation cards attached to this message */
  confirmations?: ConfirmationRequest[]
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeToolName(toolCall: any, fallback?: string): string | null {
  const name = toolCall?.name
    ?? toolCall?.function?.name
    ?? toolCall?.kwargs?.name
    ?? fallback

  return typeof name === 'string' && name.trim() ? name.trim() : null
}

function normalizeToolId(toolCall: any, fallback: string): string {
  const id = toolCall?.id ?? toolCall?.tool_call_id ?? toolCall?.function?.id
  return typeof id === 'string' && id.trim() ? id.trim() : fallback
}

function toolCallIdFromToolResultMessage(message: any, messageIndex: number, toolName: string): string {
  const id = message?.tool_call_id ?? message?.kwargs?.tool_call_id ?? message?.lc_kwargs?.tool_call_id
  if (typeof id === 'string' && id.trim()) return id.trim()
  return `${toolName}:toolmsg:${messageIndex}`
}

function inferToolKind(toolName: string): 'skill' | 'tool' {
  return toolName.startsWith('skill_')
    || toolName.startsWith('extended_')
    || toolName.startsWith('extended-')
    ? 'skill'
    : 'tool'
}

export interface ChatState {
  messages: ReturnType<typeof ref<Message[]>>
  isThinking: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string | null>>
  sendMessage: (content: string, userId?: string, files?: UploadFileInfo[]) => Promise<void>
  addMessage: (message: Message) => void
  fetchGreeting: () => Promise<void>
  confirmSkillAction: (toolCallId: string, confirmed: boolean, adjustedParams?: Record<string, unknown>) => Promise<void>
  updateConfirmationArguments: (toolCallId: string, adjustedParams: Record<string, unknown>) => void
}

const ChatKey: InjectionKey<ChatState> = Symbol('chat')

export function provideChat() {
  const messages = ref<Message[]>([])
  const isThinking = ref(false)
  const error = ref<string | null>(null)
  const activeSessionId = ref<string | null>(null)
  const { currentUser } = useUser()

  function updateLastAssistantMessage(updater: (message: Message) => Message) {
    if (messages.value.length === 0) return

    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant') return

    messages.value = [
      ...messages.value.slice(0, -1),
      updater(last),
    ]
  }

  function addMessage(message: Message) {
    messages.value = [...messages.value, message]
  }

  function upsertLlmLogEntry(entry: LlmLogEntry) {
    updateLastAssistantMessage((last) => {
      const prevLogs = last.llmLogs ?? []
      const wasNew = !prevLogs.some((e) => e.id === entry.id)
      const llmLogs = mergeLlmLogEntries(prevLogs, entry)
      const logTimeline = [...(last.logTimeline ?? [])]
      if (wasNew) {
        logTimeline.push({ kind: 'llm', id: entry.id })
      }
      return {
        ...last,
        llmLogs,
        logTimeline,
      }
    })
  }

  function setLastMessage(content: string) {
    updateLastAssistantMessage((last) => ({ ...last, content }))
  }

  function applyAssistantContent(rawContent: string) {
    const content = rawContent
    
    // 如果为空字符串，我们仍然可能需要处理（例如初始状态），但如果是纯空白字符通常可以忽略
    // 但是对于流式传输，有时会收到空包
    if (!content && content !== '') return

    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant') return

    // 如果还没有内容，直接设置
    if (!last.content) {
      setLastMessage(content)
      return
    }

    // 检查是否是全量更新（新内容包含旧内容作为前缀）
    if (content.startsWith(last.content)) {
      setLastMessage(content)
      return
    }

    // 否则当作增量追加
    updateLastAssistantMessage((current) => ({
      ...current,
      content: current.content + content,
    }))
  }

  function getChunkMessages(data: any): any[] {
    if (!data || typeof data !== 'object') return []

    const messages: any[] = [
      ...asArray(data.agent?.messages),
      ...asArray(data.messages),
      ...asArray(data.message),
    ]
    
    // 如果顶层对象看起来像个消息（有 content 和 role），也加进去
    // 这对于直接返回 AIMessageChunk 的情况很重要
    if (data.content !== undefined && (data.role || data.type)) {
      messages.push(data)
    }
    
    return messages
  }

  function inferMessageKind(message: any): string {
    const nestedType = message?.kwargs?.type
    if (typeof nestedType === 'string') return nestedType.toLowerCase()

    const explicitType = message?.type
    if (typeof explicitType === 'string') return explicitType.toLowerCase()

    const nestedRole = message?.kwargs?.role
    if (typeof nestedRole === 'string') return nestedRole.toLowerCase()

    const role = message?.role
    if (typeof role === 'string') return role.toLowerCase()

    const id = message?.id
    if (typeof id === 'string') return id.toLowerCase()
    if (Array.isArray(id)) return id.join('.').toLowerCase()

    // 兜底：如果看起来像 chunk
    if (message?.content !== undefined) return 'aimessagechunk'

    return ''
  }

  function isAssistantMessage(message: any): boolean {
    const kind = inferMessageKind(message)
    return kind.includes('assistant') || kind.includes('aimessage') || kind.includes('ai')
  }

  function isToolMessage(message: any): boolean {
    const kind = inferMessageKind(message)
    return kind.includes('toolmessage') || kind === 'tool'
  }

  function extractContent(content: unknown): string | null {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (typeof part === 'string') return part
          if (part && typeof part === 'object' && typeof (part as any).text === 'string') {
            return (part as any).text
          }
          return ''
        })
        .join('')
      return text || null
    }
    return null
  }

  function getMessageContent(message: any): string | null {
    return extractContent(message?.kwargs?.content)
      ?? extractContent(message?.content)
      ?? null
  }

  function extractMessageContent(data: any): string | null {
    if (typeof data === 'string') return data
    if (!data || typeof data !== 'object') return null
    if (data.type === 'tool_status' || data.type === 'confirmation_request') return null

    // 1. 尝试从 messages 数组中获取
    const assistantMessages = getChunkMessages(data)
      .filter((message) => isAssistantMessage(message))
    
    if (assistantMessages.length > 0) {
        const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
        const chunkAssistantContent = getMessageContent(lastAssistantMessage)
        // 允许空字符串（""），因为有时候 chunk 就是空的但有效
        if (chunkAssistantContent !== null) return chunkAssistantContent
    }

    // 2. 尝试直接作为 Message 对象处理
    if (isAssistantMessage(data.message)) {
      const simpleMsg = getMessageContent(data.message)
      if (simpleMsg !== null) return simpleMsg
    }

    if (isAssistantMessage(data)) {
      const rootMsg = getMessageContent(data)
      if (rootMsg !== null) return rootMsg
    }
    
    // 3. 最后的兜底：如果有一个 content 字段，且没有 tool_calls，假设它是内容
    if (typeof data.content === 'string' && !data.tool_calls && !data.kwargs?.tool_calls) {
      return data.content
    }

    return null
  }

  function getToolCallEntries(message: any): any[] {
    return [
      ...asArray(message?.tool_calls),
      ...asArray(message?.kwargs?.tool_calls),
      ...asArray(message?.additional_kwargs?.tool_calls),
      ...asArray(message?.kwargs?.additional_kwargs?.tool_calls),
    ]
  }

  function describeToolName(toolName: string): string {
    return toolName
      .replace(/^skill_/, '')
      .replace(/_/g, '-')
  }

  function isGenericToolDisplayName(toolName: string, displayName: string): boolean {
    return displayName === describeToolName(toolName)
  }

  function extractToolInvocationsFromChunk(data: any): ToolInvocation[] {
    return getChunkMessages(data).flatMap((message, messageIndex): ToolInvocation[] => {
      const toolCalls = getToolCallEntries(message)
      if (toolCalls.length > 0) {
        return toolCalls
          .map((toolCall, toolIndex) => {
            const toolName = normalizeToolName(toolCall)
            if (!toolName) return null

            return {
              id: normalizeToolId(toolCall, `${toolName}:${messageIndex}:${toolIndex}`),
              name: toolName,
              displayName: describeToolName(toolName),
              kind: inferToolKind(toolName),
              status: 'running' as ToolInvocationStatus,
              arguments: extractArgumentsFromToolCallPayload(toolCall),
              children: [],
            }
          })
          .filter(Boolean) as ToolInvocation[]
      }

      if (!isToolMessage(message)) return []

      const toolName = normalizeToolName(message, message?.kwargs?.name)
      if (!toolName) return []

      const content = String(message?.content ?? message?.kwargs?.content ?? '').toLowerCase()
      return [{
        id: toolCallIdFromToolResultMessage(message, messageIndex, toolName),
        name: toolName,
        displayName: describeToolName(toolName),
        kind: inferToolKind(toolName),
        status: content.startsWith('error') ? 'failed' : 'completed',
        arguments: extractArgumentsFromToolResultMessage(message),
        children: [],
      }]
    })
  }

  function isToolStatusEvent(data: any): data is {
    type: 'tool_status'
    toolId: string
    toolName: string
    displayName: string
    kind: 'skill' | 'tool'
    status: ToolInvocationStatus
    parentToolId?: string
    parentToolName?: string
    summary?: string
    arguments?: unknown
    result?: string
    executionMode?: string
    executionLabel?: string
  } {
    return data?.type === 'tool_status'
      && typeof data.toolId === 'string'
      && typeof data.toolName === 'string'
      && typeof data.displayName === 'string'
      && (data.kind === 'skill' || data.kind === 'tool')
      && ['running', 'completed', 'failed'].includes(data.status)
  }

  function isPollingStatusEvent(data: any): data is {
    type: 'polling_status'
    tasks: Array<{
      asyncTaskId: number
      externalTaskId: string | null
      status: string
      retryCount: number
      elapsedSeconds: number
      pollResponses: Array<{ time: string; body: string }>
    }>
  } {
    return data?.type === 'polling_status'
      && Array.isArray(data.tasks)
  }

  function mergeToolResultField(previous: string | undefined, next: string | undefined): string | undefined {
    return next !== undefined ? next : previous
  }

  function upsertChildToolInvocation(children: ToolInvocation[], toolEvent: {
    toolId: string
    toolName: string
    displayName: string
    kind: 'skill' | 'tool'
    status: ToolInvocationStatus
    summary?: string
    arguments?: unknown
    result?: string
  }) {
    const nextChildren = [...children]
    const existingIndex = nextChildren.findIndex((tool) => tool.id === toolEvent.toolId)
    const previous = existingIndex >= 0 ? nextChildren[existingIndex] : null
    const nextChild: ToolInvocation = {
      id: toolEvent.toolId,
      name: toolEvent.toolName,
      displayName: toolEvent.displayName,
      kind: toolEvent.kind,
      status: toolEvent.status,
      summary: toolEvent.summary,
      arguments: mergeToolArgumentsField(previous?.arguments, toolEvent.arguments),
      result: mergeToolResultField(previous?.result, toolEvent.result),
      children: previous?.children ?? [],
    }

    if (existingIndex >= 0) {
      nextChildren.splice(existingIndex, 1, nextChild)
    } else {
      nextChildren.push(nextChild)
    }

    return nextChildren
  }

  function appendToolTimelineEntry(toolId: string) {
    updateLastAssistantMessage((last) => {
      const logTimeline = [...(last.logTimeline ?? [])]
      if (logTimeline.some((t) => t.kind === 'tool' && t.id === toolId)) {
        return last
      }
      logTimeline.push({ kind: 'tool', id: toolId })
      return { ...last, logTimeline }
    })
  }

  function applyConfirmationExecutionOutcome(
    confirmations: ConfirmationRequest[],
    toolId: string,
    toolStatus: ToolInvocationStatus,
  ): ConfirmationRequest[] {
    if (toolStatus !== 'completed' && toolStatus !== 'failed') return confirmations
    return confirmations.map((c) =>
      c.toolCallId === toolId && c.status === 'confirmed'
        ? {
            ...c,
            executionOutcome: toolStatus === 'completed' ? 'completed' : 'failed',
          }
        : c,
    )
  }

  function upsertToolInvocation(toolEvent: {
    toolId: string
    toolName: string
    displayName: string
    kind: 'skill' | 'tool'
    status: ToolInvocationStatus
    parentToolId?: string
    parentToolName?: string
    summary?: string
    arguments?: unknown
    result?: string
    executionMode?: string
    executionLabel?: string
  }) {
    updateLastAssistantMessage((last) => {
      const toolInvocations = [...(last.toolInvocations ?? [])]
      if (toolEvent.parentToolId || toolEvent.parentToolName) {
        const parentIndex = toolInvocations.findIndex((tool) => tool.id === toolEvent.parentToolId)
        const fallbackParentIndex = parentIndex >= 0
          ? parentIndex
          : toolInvocations.findIndex((tool) => tool.name === toolEvent.parentToolName)
        const targetParentIndex = parentIndex >= 0 ? parentIndex : fallbackParentIndex
        const parent: ToolInvocation = targetParentIndex >= 0 && toolInvocations[targetParentIndex]
          ? toolInvocations[targetParentIndex]
          : {
            id: toolEvent.parentToolId || toolEvent.parentToolName || toolEvent.toolId,
            name: toolEvent.parentToolName || toolEvent.parentToolId || toolEvent.toolName,
            displayName: toolEvent.parentToolName || toolEvent.parentToolId || toolEvent.displayName,
            kind: 'skill' as const,
            status: 'running' as ToolInvocationStatus,
            children: [],
          }

        const nextParent: ToolInvocation = {
          ...parent,
          children: upsertChildToolInvocation(parent.children ?? [], {
            toolId: toolEvent.toolId,
            toolName: toolEvent.toolName,
            displayName: toolEvent.displayName,
            kind: toolEvent.kind,
            status: toolEvent.status,
            summary: toolEvent.summary,
            arguments: toolEvent.arguments,
            result: toolEvent.result,
          }),
        }

        if (targetParentIndex >= 0) {
          toolInvocations.splice(targetParentIndex, 1, nextParent)
        } else {
          toolInvocations.push(nextParent)
        }

        const confirmations = applyConfirmationExecutionOutcome(
          last.confirmations ?? [],
          toolEvent.toolId,
          toolEvent.status,
        )

        if (toolEvent.status === 'failed' && toolEvent.result) {
          console.warn(`[skill] upsertTool FAILED (child): tool=${toolEvent.toolName} (${toolEvent.toolId})`, {
            result: typeof toolEvent.result === 'string' ? toolEvent.result.slice(0, 500) : toolEvent.result,
          })
        }

        return {
          ...last,
          toolInvocations,
          confirmations,
        }
      }

      const existingIndex = toolInvocations.findIndex((tool) => tool.id === toolEvent.toolId)
      const previousTool = existingIndex >= 0 ? toolInvocations[existingIndex] : null
      const nextDisplayName = previousTool
        && isGenericToolDisplayName(toolEvent.toolName, toolEvent.displayName)
        && !isGenericToolDisplayName(previousTool.name, previousTool.displayName)
        ? previousTool.displayName
        : toolEvent.displayName

      const nextTool: ToolInvocation = {
        id: toolEvent.toolId,
        name: toolEvent.toolName,
        displayName: nextDisplayName,
        kind: toolEvent.kind,
        status: toolEvent.status,
        summary: toolEvent.summary,
        arguments: mergeToolArgumentsField(previousTool?.arguments, toolEvent.arguments),
        result: mergeToolResultField(previousTool?.result, toolEvent.result),
        executionMode: toolEvent.executionMode,
        executionLabel: toolEvent.executionLabel,
        children: previousTool?.children ?? [],
      }

      if (existingIndex >= 0) {
        toolInvocations.splice(existingIndex, 1, nextTool)
      } else {
        toolInvocations.push(nextTool)
      }

      const confirmations = applyConfirmationExecutionOutcome(
        last.confirmations ?? [],
        toolEvent.toolId,
        toolEvent.status,
      )

      if (toolEvent.status === 'failed' && toolEvent.result) {
        console.warn(`[skill] upsertTool FAILED: tool=${toolEvent.toolName} (${toolEvent.toolId})`, {
          result: typeof toolEvent.result === 'string' ? toolEvent.result.slice(0, 500) : toolEvent.result,
        })
      }

      return {
        ...last,
        toolInvocations,
        confirmations,
      }
    })
  }

  function settleLastToolInvocations(status: ToolInvocationStatus) {
    updateLastAssistantMessage((last) => ({
      ...last,
      toolInvocations: (last.toolInvocations ?? []).map((tool) => ({
        ...tool,
        status: tool.status === 'running' ? status : tool.status,
        children: (tool.children ?? []).map((child) => (
          child.status === 'running'
            ? { ...child, status }
            : child
        )),
      })),
      confirmations: (last.confirmations ?? []).map((c) =>
        c.status === 'pending' ? { ...c, status: 'expired' as ConfirmationStatus } : c,
      ),
    }))
  }

  function handlePollingStatus(data: { tasks: Array<{ asyncTaskId: number; externalTaskId: string | null; status: string; retryCount: number; elapsedSeconds: number; pollResponses: Array<{ time: string; body: string }> }> }) {
    for (const task of data.tasks) {
      const toolId = `async_${task.asyncTaskId}`
      const displayName = task.externalTaskId
        ? `异步任务 ${task.externalTaskId}`
        : `异步任务 #${task.asyncTaskId}`

      const newResponses: PollResponseEntry[] = (task.pollResponses || []).map(r => ({
        time: r.time,
        body: r.body.length > 200 ? r.body.slice(0, 200) + '…' : r.body,
      }))

      updateLastAssistantMessage((last) => {
        const toolInvocations = [...(last.toolInvocations ?? [])]
        const existingIndex = toolInvocations.findIndex((t) => t.id === toolId)
        const existing = existingIndex >= 0 ? toolInvocations[existingIndex] : null
        const existingResponses = existing?.pollingStatus?.pollResponses ?? []

        const pollingStatus: PollingStatus = {
          status: task.status,
          retryCount: task.retryCount,
          elapsedSeconds: task.elapsedSeconds,
          pollResponses: [...existingResponses, ...newResponses.filter(
            nr => !existingResponses.some(er => er.time === nr.time)
          )],
        }

        const next: ToolInvocation = {
          id: toolId,
          name: toolId,
          displayName,
          kind: 'skill',
          status: existing?.status ?? 'running',
          pollingStatus,
          result: existing?.result,
          arguments: existing?.arguments,
          children: existing?.children ?? [],
        }

        if (existingIndex >= 0) {
          toolInvocations.splice(existingIndex, 1, next)
        } else {
          toolInvocations.push(next)
        }

        return { ...last, toolInvocations }
      })

      console.log(`[skill] polling_status: task=${task.asyncTaskId} status=${task.status} retries=${task.retryCount} elapsed=${task.elapsedSeconds}s responses=${newResponses.length}`)
    }
  }

  function isConfirmationRequestEvent(data: any): data is {
    type: 'confirmation_request'
    sessionId: string
    toolCallId: string
    toolName: string
    skillName: string
    summary: string
    details: string
    arguments?: unknown
  } {
    return data?.type === 'confirmation_request'
      && typeof data.sessionId === 'string'
      && typeof data.toolCallId === 'string'
  }

  function addConfirmationToLastAssistant(req: ConfirmationRequest) {
    updateLastAssistantMessage((last) => ({
      ...last,
      confirmations: [...(last.confirmations ?? []), req],
    }))
  }

  function updateConfirmationStatus(toolCallId: string, status: ConfirmationStatus) {
    updateLastAssistantMessage((last) => ({
      ...last,
      confirmations: (last.confirmations ?? []).map((c) => {
        if (c.toolCallId !== toolCallId) return c
        if (status === 'confirmed') {
          return { ...c, status, executionOutcome: 'running' }
        }
        return { ...c, status, executionOutcome: undefined }
      }),
    }))
  }

  async function confirmSkillAction(toolCallId: string, confirmed: boolean, adjustedParams?: Record<string, unknown>) {
    const sid = activeSessionId.value
    if (!sid) return

    const newStatus: ConfirmationStatus = confirmed ? 'confirmed' : 'cancelled'
    updateConfirmationStatus(toolCallId, newStatus)

    if (confirmed) {
      console.log(`[skill] confirmAction SEND: toolCallId=${toolCallId} confirmed=true`, {
        adjustedParams,
        sessionId: sid,
      })
    } else {
      console.log(`[skill] confirmAction SEND: toolCallId=${toolCallId} confirmed=false`)
    }

    try {
      await confirmAction(sid, toolCallId, confirmed, adjustedParams)
      console.log(`[skill] confirmAction OK: toolCallId=${toolCallId} confirmed=${confirmed}`)
    } catch (e) {
      console.error(`[skill] confirmAction FAILED: toolCallId=${toolCallId}`, e)
      updateConfirmationStatus(toolCallId, 'pending')
      error.value = e instanceof Error ? e.message : 'Confirmation request failed'
    }
  }

  function updateConfirmationArguments(toolCallId: string, adjustedParams: Record<string, unknown>) {
    updateLastAssistantMessage((last) => ({
      ...last,
      confirmations: (last.confirmations ?? []).map((c) => {
        if (c.toolCallId !== toolCallId) return c;
        return { ...c, arguments: adjustedParams };
      }),
      toolInvocations: (last.toolInvocations ?? []).map((t) => {
        if (t.id !== toolCallId) return t;
        return { ...t, arguments: adjustedParams };
      }),
    }));
  }

  async function sendMessage(content: string, userId?: string, files?: UploadFileInfo[]) {
    if (isThinking.value) return
    // files 已由 MessageInput 通过解析流程合并到 content / getAllParsedText；此处保留参数仅为类型兼容。
    void files

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    addMessage(userMessage)
    isThinking.value = true
    error.value = null

    try {
      // Get recent history (e.g., last 10 messages) to provide short-term context
      const history = messages.value.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const { id } = await createTask(content, userId, history)
      activeSessionId.value = id
      const url = getEventSourceUrl(id)

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        sessionId: id,
        toolInvocations: [],
        llmLogs: [],
        logTimeline: [],
      })

      const eventSource = new EventSource(url)

      eventSource.onmessage = (event) => {
        try {
          if (event.data) {
            let data: any
            try {
              data = JSON.parse(event.data)
            } catch {
              // 纯文本数据
              console.log('Received raw text:', event.data)
              applyAssistantContent(event.data)
              return
            }

            console.log('Received JSON data:', data)
            if (isLlmLogEvent(data)) {
              if (activeSessionId.value && data.entry.sessionId === activeSessionId.value) {
                upsertLlmLogEntry(data.entry)
              }
              return
            }

            if (isToolStatusEvent(data)) {
              if (data.status === 'failed') {
                console.warn(`[skill] tool_status FAILED: tool=${data.toolName} (${data.toolId}) kind=${data.kind}`, {
                  result: data.result,
                  arguments: data.arguments,
                })
              } else if (data.status === 'completed') {
                console.log(`[skill] tool_status completed: tool=${data.toolName} (${data.toolId}) kind=${data.kind} resultLen=${typeof data.result === 'string' ? data.result.length : 'N/A'}`)
              } else {
                console.log(`[skill] tool_status running: tool=${data.toolName} (${data.toolId}) kind=${data.kind}`)
              }
              upsertToolInvocation(data)
              appendToolTimelineEntry(data.toolId)
              return
            }

            if (isConfirmationRequestEvent(data)) {
              console.log(`[skill] confirmation_request: skill=${data.skillName} tool=${data.toolName} toolCallId=${data.toolCallId}`, {
                arguments: data.arguments,
              })
              addConfirmationToLastAssistant({
                sessionId: data.sessionId,
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                skillName: data.skillName,
                summary: data.summary,
                details: data.details,
                arguments: data.arguments,
                status: 'pending',
              })
              return
            }

            const rawToolInvocations = extractToolInvocationsFromChunk(data)
            if (rawToolInvocations.length > 0) {
              rawToolInvocations.forEach((toolInvocation) => {
                upsertToolInvocation({
                  toolId: toolInvocation.id,
                  toolName: toolInvocation.name,
                  displayName: toolInvocation.displayName,
                  kind: toolInvocation.kind,
                  status: toolInvocation.status,
                  arguments: toolInvocation.arguments,
                  executionMode: toolInvocation.executionMode,
                  executionLabel: toolInvocation.executionLabel,
                })
                appendToolTimelineEntry(toolInvocation.id)
              })
            }

            if (typeof data?.error === 'string') {
              console.error(`[skill] SSE error event: ${data.error}`)
              error.value = data.error
              settleLastToolInvocations('failed')
              isThinking.value = false
              return
            }

            const extracted = extractMessageContent(data)
            if (extracted !== null) {
              console.log('Extracted content:', extracted)
              applyAssistantContent(extracted)
            } else {
              console.log('No content extracted from data')
            }
          }
        } catch (e) {
          console.error('Error handling event:', e)
        }
      }

      eventSource.addEventListener('complete', () => {
        console.log('Stream complete')
        eventSource.close()
        settleLastToolInvocations('completed')
        isThinking.value = false
        activeSessionId.value = null
      })

      eventSource.addEventListener('polling_status', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (isPollingStatusEvent(data)) {
            handlePollingStatus(data)
          }
        } catch (e) {
          console.error('[skill] Error parsing polling_status event:', e)
        }
      })

      eventSource.addEventListener('error', () => {
        console.error('[skill] SSE connection error:', {
          readyState: eventSource.readyState,
          sessionId: activeSessionId.value,
        })
        eventSource.close()
        settleLastToolInvocations('failed')
        isThinking.value = false
        activeSessionId.value = null
      })
    } catch (err) {
      console.error('[skill] Failed to send message:', err)
      error.value = err instanceof Error ? err.message : 'Failed to send message'
      isThinking.value = false
      activeSessionId.value = null
    }
  }

  async function fetchGreeting() {
    if (messages.value.length > 0) return
    if (!currentUser.value) return

    try {
        const res = await fetch(agentUrl('/features/avatar/greeting'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nickname: currentUser.value.nickname,
                avatar: currentUser.value.avatar
            })
        });
        const data = await res.json()
        const greetingContent = extractMessageContent(data) ?? data?.greeting ?? null

        if (typeof greetingContent === 'string' && greetingContent.length > 0) {
          addMessage({
            id: 'greeting',
            role: 'assistant',
            content: greetingContent,
            timestamp: Date.now(),
            toolInvocations: [],
            llmLogs: [],
            logTimeline: [],
          })
        }
    } catch (e) {
        console.error("Failed to fetch greeting:", e)
    }
  }

  const state: ChatState = {
    messages,
    isThinking,
    error,
    sendMessage,
    addMessage,
    fetchGreeting,
    confirmSkillAction,
    updateConfirmationArguments,
  }
  provide(ChatKey, state)
  return state
}

export function useChat(): ChatState {
  const state = inject(ChatKey)
  if (!state) throw new Error('useChat must be used within a provider that calls provideChat()')
  return state
}
