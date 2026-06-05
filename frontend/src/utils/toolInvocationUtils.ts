/**
 * Merge tool `arguments` for SSE/chunk updates: only overwrite when the incoming
 * payload explicitly includes `arguments` (not undefined).
 */
export function mergeToolArgumentsField(
  previous: unknown | undefined,
  incoming: unknown | undefined,
): unknown | undefined {
  if (incoming !== undefined) return incoming
  return previous
}

export function parseStreamToolArguments(raw: unknown): unknown | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return undefined
    try {
      return JSON.parse(s) as unknown
    } catch {
      return raw
    }
  }
  return raw
}

export function extractArgumentsFromToolCallPayload(toolCall: unknown): unknown | undefined {
  if (!toolCall || typeof toolCall !== 'object') return undefined
  const tc = toolCall as Record<string, unknown>
  const fn = tc.function as Record<string, unknown> | undefined
  const raw =
    tc.args
    ?? tc.arguments
    ?? fn?.arguments
    ?? fn?.args
    ?? (tc.kwargs as Record<string, unknown> | undefined)?.args
    ?? (tc.kwargs as Record<string, unknown> | undefined)?.arguments
  return parseStreamToolArguments(raw)
}

export function extractArgumentsFromToolResultMessage(message: unknown): unknown | undefined {
  if (!message || typeof message !== 'object') return undefined
  const m = message as Record<string, unknown>
  const kwargs = m.kwargs as Record<string, unknown> | undefined
  const raw =
    kwargs?.args
    ?? kwargs?.arguments
    ?? m.args
    ?? m.arguments
  return parseStreamToolArguments(raw)
}
