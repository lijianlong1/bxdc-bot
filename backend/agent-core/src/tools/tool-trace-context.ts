import { AsyncLocalStorage } from "node:async_hooks";

export type ToolTraceStatus = "running" | "completed" | "failed";

export interface ToolTraceEvent {
  type: "tool_status";
  toolId: string;
  toolName: string;
  displayName: string;
  kind: "skill" | "tool";
  status: ToolTraceStatus;
  parentToolId?: string;
  parentToolName?: string;
  summary?: string;
  arguments?: unknown;
  /** Tool function return body (e.g. JSON string from gateway); sanitized and length-capped. */
  result?: string;
  executionMode?: string;
  executionLabel?: string;
}

interface ToolTraceContextValue {
  emit: (event: ToolTraceEvent) => void;
  activeParentToolIds: Map<string, string>;
}

const toolTraceContext = new AsyncLocalStorage<ToolTraceContextValue>();

export function sanitizeToolTraceArguments(value: unknown, depth = 0): unknown {
  if (depth > 10) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolTraceArguments(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes("apikey")
        || normalizedKey.includes("token")
        || normalizedKey.includes("authorization")
        || normalizedKey.includes("password")
        || normalizedKey.includes("privatekey")
        || normalizedKey.includes("secret")
        || normalizedKey.includes("cookie")
      ) {
        result[key] = "[redacted]";
        continue;
      }
      result[key] = sanitizeToolTraceArguments(raw, depth + 1);
    }
    return result;
  }
  return String(value);
}

const MAX_TOOL_RESULT_CHARS = 48_000;

/**
 * Sanitize and cap tool output for SSE / UI (may be JSON or plain text).
 */
export function sanitizeToolResultForTrace(text: string): string {
  const raw =
    text.length > MAX_TOOL_RESULT_CHARS
      ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n...[truncated]`
      : text;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeToolTraceArguments(parsed);
    if (typeof sanitized === "string") return sanitized;
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return raw;
  }
}

export async function runWithToolTraceContext<T>(
  emit: (event: ToolTraceEvent) => void,
  work: () => Promise<T>,
): Promise<T> {
  return await toolTraceContext.run({ emit, activeParentToolIds: new Map() }, work);
}

export function emitToolTraceEvent(event: ToolTraceEvent): void {
  toolTraceContext.getStore()?.emit(event);
}

export function setActiveParentToolId(toolName: string, toolId: string): void {
  if (!toolName || !toolId) return;
  toolTraceContext.getStore()?.activeParentToolIds.set(toolName, toolId);
}

export function clearActiveParentToolId(toolName: string, toolId?: string): void {
  const store = toolTraceContext.getStore();
  if (!store || !toolName) return;

  const current = store.activeParentToolIds.get(toolName);
  if (!current) return;
  if (!toolId || current === toolId) {
    store.activeParentToolIds.delete(toolName);
  }
}

export function getActiveParentToolId(toolName: string): string | undefined {
  return toolTraceContext.getStore()?.activeParentToolIds.get(toolName);
}
