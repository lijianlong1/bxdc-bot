import { ref } from 'vue'

export type ThinkingNodeType = 'thinking' | 'tool_call' | 'tool_result' | 'llm_call' | 'processing'
export type ThinkingNodeStatus = 'pending' | 'active' | 'completed' | 'error'

export interface ThinkingNode {
  id: string
  type: ThinkingNodeType
  title: string
  content?: string
  status: ThinkingNodeStatus
  timestamp: number
  metadata?: Record<string, any>
}

export interface ThinkingSession {
  id: string
  nodes: ThinkingNode[]
  isActive: boolean
  startTime: number
  endTime?: number
}

const activeSessions = ref<Map<string, ThinkingSession>>(new Map())

export function useThinkingMode() {
  const getSession = (sessionId: string): ThinkingSession | undefined => {
    return activeSessions.value.get(sessionId)
  }

  const createSession = (sessionId: string): ThinkingSession => {
    const session: ThinkingSession = {
      id: sessionId,
      nodes: [],
      isActive: true,
      startTime: Date.now(),
    }
    activeSessions.value.set(sessionId, session)
    return session
  }

  const addNode = (
    sessionId: string,
    node: Omit<ThinkingNode, 'id' | 'timestamp'>
  ): ThinkingNode => {
    let session = activeSessions.value.get(sessionId)
    if (!session) {
      session = createSession(sessionId)
    }

    // 将之前的 active 节点标记为 completed
    session.nodes.forEach(n => {
      if (n.status === 'active') {
        n.status = 'completed'
      }
    })

    const newNode: ThinkingNode = {
      ...node,
      id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }

    session.nodes.push(newNode)
    return newNode
  }

  const updateNodeStatus = (
    sessionId: string,
    nodeId: string,
    status: ThinkingNode['status']
  ) => {
    const session = activeSessions.value.get(sessionId)
    if (!session) return

    const node = session.nodes.find(n => n.id === nodeId)
    if (node) {
      node.status = status
    }
  }

  const completeSession = (sessionId: string) => {
    const session = activeSessions.value.get(sessionId)
    if (!session) return

    session.isActive = false
    session.endTime = Date.now()
    
    // 将所有 active 节点标记为 completed
    session.nodes.forEach(n => {
      if (n.status === 'active') {
        n.status = 'completed'
      }
    })
  }

  const clearSession = (sessionId: string) => {
    activeSessions.value.delete(sessionId)
  }

  // 根据 SSE 事件创建思考节点
  const processStreamEvent = (
    sessionId: string,
    eventData: any
  ): ThinkingNode | null => {
    if (!eventData || typeof eventData !== 'object') return null

    // 工具调用事件
    if (eventData.type === 'tool_status') {
      const existingNode = getSession(sessionId)?.nodes.find(
        n => n.metadata?.toolCallId === eventData.toolId && n.type === 'tool_call'
      )

      if (existingNode) {
        // 更新现有节点
        if (eventData.status === 'completed') {
          existingNode.status = 'completed'
          existingNode.content = eventData.result || '工具调用完成'
        } else if (eventData.status === 'failed') {
          existingNode.status = 'error'
          existingNode.content = '工具调用失败'
        }
        return existingNode
      } else if (eventData.status === 'running') {
        // 创建新节点
        return addNode(sessionId, {
          type: 'tool_call',
          title: `调用工具: ${eventData.displayName || eventData.toolName}`,
          content: eventData.arguments ? JSON.stringify(eventData.arguments, null, 2).slice(0, 100) : '',
          status: 'active',
          metadata: {
            toolCallId: eventData.toolId,
            toolName: eventData.toolName,
            ...eventData,
          },
        })
      }
    }

    // LLM 推理事件 - 避免重复创建
    if (eventData.type === 'llm_log' || eventData.type === 'llm_request') {
      const existingLlmNode = getSession(sessionId)?.nodes.find(
        n => n.type === 'llm_call' && n.status === 'active'
      )
      
      if (existingLlmNode) {
        // 已有活跃的 LLM 节点，不重复创建
        return existingLlmNode
      }
      
      // 创建新的 LLM 节点
      return addNode(sessionId, {
        type: 'llm_call',
        title: '模型推理',
        content: '正在推理...',
        status: 'active',
      })
    }

    // 助手回复事件
    if (eventData.role === 'assistant' && eventData.content) {
      const content = typeof eventData.content === 'string' 
        ? eventData.content 
        : JSON.stringify(eventData.content)
      
      // 检查是否已有处理节点
      const existingProcessNode = getSession(sessionId)?.nodes.find(
        n => n.type === 'processing' && n.status === 'active'
      )

      if (existingProcessNode) {
        existingProcessNode.content = content.slice(0, 150)
        return existingProcessNode
      }

      return addNode(sessionId, {
        type: 'processing',
        title: '生成回复',
        content: content.slice(0, 150),
        status: 'active',
        metadata: { hasContent: true },
      })
    }

    // 思考中节点（初始节点）
    if (getSession(sessionId)?.nodes.length === 0) {
      return addNode(sessionId, {
        type: 'thinking',
        title: '开始调用',
        content: '准备调用流程...',
        status: 'active',
      })
    }

    return null
  }

  return {
    activeSessions,
    getSession,
    createSession,
    addNode,
    updateNodeStatus,
    completeSession,
    clearSession,
    processStreamEvent,
  }
}