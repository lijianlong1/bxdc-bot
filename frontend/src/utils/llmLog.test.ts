import { describe, expect, it } from 'vitest'
import { isLlmLogEvent, mergeLlmLogEntries } from './llmLog'

describe('llmLog', () => {
  it('recognizes structured llm log events', () => {
    expect(isLlmLogEvent({
      type: 'llm_log',
      entry: {
        id: 'log-1',
        sessionId: 'session-1',
        invocationId: 'run-1',
        direction: 'request',
        stage: 'chat_model',
        timestamp: '2026-03-27T10:00:00.000Z',
        summary: '模型 gpt-4o · 2 条消息',
      },
    })).toBe(true)
  })

  it('merges and sorts entries by timestamp', () => {
    const merged = mergeLlmLogEntries([
      {
        id: 'b',
        sessionId: 'session-1',
        invocationId: 'run-1',
        direction: 'response',
        stage: 'chat_model',
        timestamp: '2026-03-27T10:00:02.000Z',
        summary: 'response',
      },
    ], {
      id: 'a',
      sessionId: 'session-1',
      invocationId: 'run-1',
      direction: 'request',
      stage: 'chat_model',
      timestamp: '2026-03-27T10:00:01.000Z',
      summary: 'request',
    })

    expect(merged.map((entry) => entry.id)).toEqual(['a', 'b'])
  })
})
