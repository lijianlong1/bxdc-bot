import { apiUrl, agentUrl } from './config'

export async function createTask(content: string, userId?: string, history?: any[], sessionId?: string): Promise<{ id: string }> {
  const response = await fetch(apiUrl('/api/tasks'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, userId, history, sessionId }),
  })

  if (!response.ok) {
    throw new Error('Failed to create task')
  }

  return response.json()
}

export function getEventSourceUrl(taskId: string): string {
  return apiUrl(`/api/tasks/${taskId}/events`)
}

export function getAgentStreamUrl(): string {
  return agentUrl('/agent/run')
}

export async function confirmAction(
  sessionId: string,
  toolCallId: string,
  confirmed: boolean,
  adjustedParams?: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(agentUrl('/agent/confirm'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, toolCallId, confirmed, adjustedParams }),
  })

  if (!response.ok) {
    const detail =
      response.status === 404
        ? 'No pending confirmation (session may have expired).'
        : `Confirm request failed (${response.status})`
    throw new Error(detail)
  }
}
