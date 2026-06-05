import { ref, provide, inject, type InjectionKey } from 'vue'
import { confirmAction, getAgentStreamUrl } from '../services/api'
import { agentUrl } from '../services/config'
import { useUser } from './useUser'
import { useFileUpload } from './useFileUpload'
import { type LlmLogEntry, isLlmLogEvent, mergeLlmLogEntries } from '../utils/llmLog'
import {
  extractArgumentsFromToolCallPayload,
  extractArgumentsFromToolResultMessage,
  mergeToolArgumentsField,
} from '../utils/toolInvocationUtils'
import { useThinkingMode } from './useThinkingMode'
import type { UploadFileInfo } from '../types/fileUpload'

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
  sendMessage: (content: string, userId?: string, attachedFiles?: UploadFileInfo[]) => Promise<void>
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
  const { createSession, processStreamEvent, completeSession } = useThinkingMode()
  const fileUpload = useFileUpload()

  function generateConversationSessionId(): string {
    // 为每条消息生成唯一的 sessionId，确保每条消息有独立的思考状态
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

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
    // 过滤 think 标签，确保思考内容不会显示给用户
    const content = removeThinkTags(rawContent)
    
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

    // 检查是否是重复内容（后端可能会重复发送相同内容）
    if (last.content.endsWith(content)) {
      return
    }

    // 如果新内容是旧内容的延续（以旧内容开头），只追加新部分
    if (content.startsWith(last.content)) {
      const newPart = content.slice(last.content.length)
      if (newPart.length > 0) {
        updateLastAssistantMessage((current) => ({
          ...current,
          content: current.content + newPart,
        }))
      }
      return
    }

    // 否则直接追加（处理乱序或特殊情况）
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

  function removeThinkTags(content: string): string {
    // 移除 <think>...</think> 标签及其内容
    return content.replace(/<think[\s\S]*?<\/think>/gi, '')
  }

  function extractContent(content: unknown): string | null {
    if (typeof content === 'string') {
      // 过滤 think 标签
      return removeThinkTags(content)
    }
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (typeof part === 'string') return removeThinkTags(part)
          if (part && typeof part === 'object' && typeof (part as any).text === 'string') {
            return removeThinkTags((part as any).text)
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
      return removeThinkTags(data.content)
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

  async function sendMessage(content: string, userId?: string, attachedFiles?: UploadFileInfo[]) {
    if (isThinking.value) return

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

      const sessionId = generateConversationSessionId()
      activeSessionId.value = sessionId

      // 初始化思考模式会话
      createSession(sessionId)

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        sessionId,
        toolInvocations: [],
        llmLogs: [],
        logTimeline: [],
      })

      const url = getAgentStreamUrl()

      // 拼接文件解析内容到 instruction（任务 8 拼接，任务 pass-parsed-content-to-llm 改用统一截断逻辑）
      let finalInstruction = content
      if (attachedFiles && attachedFiles.length > 0) {
        // sendMessage 在函数体内调用 useFileUpload() 会让 inject 失败（currentInstance 为 null），
        // 降级分支返回新的空 state，getAllParsedText() 因此返回空。
        // 解决：在 MessageInput 端拿到 fileUpload state，把截断函数传一个能接受 files 参数的实现。
        const fileUpload = useFileUpload()
        const fileParts = fileUpload.getAllParsedText(attachedFiles)
        if (fileParts.length > 0) {
          finalInstruction = `${content}\n\n${fileParts}`
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          instruction: finalInstruction,
          context: {
            userId,
            sessionId,
          },
          history,
        }),
      })

      if (!response.ok) {
        console.error('[skill] Failed to connect to agent:', response.statusText)
        isThinking.value = false
        error.value = 'Failed to connect to agent'
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        console.error('[skill] No response body')
        isThinking.value = false
        return
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('Stream complete')
          settleLastToolInvocations('completed')
          isThinking.value = false
          // 完成思考模式会话
          if (activeSessionId.value) {
            completeSession(activeSessionId.value)
          }
          activeSessionId.value = null

          // 上报本次对话涉及的文件名（任务 8.3）
          if (attachedFiles && attachedFiles.length > 0 && userId) {
            const fileNames = attachedFiles.map((f) => f.fileName)
            try {
              await fetch(agentUrl('/memory/add'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  text: `本次对话涉及文件：${fileNames.join('、')}`,
                  role: 'system',
                }),
              })
            } catch (e) {
              console.error('[chat] Failed to add file memory:', e)
            }
          }

          break
        }

        buffer += decoder.decode(value, { stream: true })
        
        // 按行处理 SSE 格式的数据
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          
          try {
            // 解析 SSE 格式：data: {"key": "value"}
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6)
              if (!jsonStr.trim()) continue
              
              let data: any
              try {
                data = JSON.parse(jsonStr)
              } catch {
                console.log('Received raw text:', jsonStr)
                applyAssistantContent(jsonStr)
                continue
              }

              console.log('Received JSON data:', data)
              
              // 处理思考模式节点
              if (activeSessionId.value) {
                processStreamEvent(activeSessionId.value, data)
              }
              
              if (isLlmLogEvent(data)) {
                if (activeSessionId.value && data.entry.sessionId === activeSessionId.value) {
                  upsertLlmLogEntry(data.entry)
                }
                continue
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
                continue
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
                continue
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
      }
    } catch (err) {
      console.error('[skill] Failed to send message:', err)
      error.value = err instanceof Error ? err.message : 'Failed to send message'
      isThinking.value = false
      activeSessionId.value = null
    } finally {
      // 发送完成后清空文件状态（任务 8.4）
      if (attachedFiles && attachedFiles.length > 0) {
        fileUpload.clearFiles()
      }
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
