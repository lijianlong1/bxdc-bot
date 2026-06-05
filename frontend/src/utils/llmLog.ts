export interface LlmLogEntry {
  id: string
  sessionId: string
  invocationId: string
  direction: 'request' | 'response'
  stage: 'chat_model'
  timestamp: string
  summary: string
  modelName?: string
  request?: Record<string, unknown>
  response?: Record<string, unknown>
}

export function isLlmLogEvent(data: any): data is { type: 'llm_log'; entry: LlmLogEntry } {
  return data?.type === 'llm_log'
    && data.entry
    && typeof data.entry.id === 'string'
    && typeof data.entry.sessionId === 'string'
    && (data.entry.direction === 'request' || data.entry.direction === 'response')
}

export function mergeLlmLogEntries(entries: LlmLogEntry[], nextEntry: LlmLogEntry): LlmLogEntry[] {
  const nextEntries = [...entries]
  const existingIndex = nextEntries.findIndex((entry) => entry.id === nextEntry.id)
  if (existingIndex >= 0) {
    nextEntries.splice(existingIndex, 1, nextEntry)
  } else {
    nextEntries.push(nextEntry)
  }

  nextEntries.sort((a, b) => {
    const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id)
  })

  return nextEntries
}
