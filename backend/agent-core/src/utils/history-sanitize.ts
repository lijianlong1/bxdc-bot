/**
 * Short-term chat history sent to the LLM — strip progressive-disclosure payloads
 * (REQUIRE_PARAMETERS + large contracts) to avoid context bloat. See agent-history-compression.
 */

export const PROGRESSIVE_DISCLOSURE_PLACEHOLDER =
  "[Prior skill turn: parameter contract was requested; full disclosure text omitted.]";

const LARGE_DISCLOSURE_MIN_LEN = 800;

function normalizeMessageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as { text?: string }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  if (typeof content === "object") {
    return JSON.stringify(content);
  }
  return String(content);
}

function looksLikeRequireParametersObject(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const st = (parsed as Record<string, unknown>).status;
  return st === "REQUIRE_PARAMETERS";
}

/**
 * If `raw` parses as a single JSON object with status REQUIRE_PARAMETERS, return placeholder.
 */
function tryReplaceWholeJsonDisclosure(raw: string): string | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (looksLikeRequireParametersObject(parsed)) {
      return PROGRESSIVE_DISCLOSURE_PLACEHOLDER;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * End index (exclusive) of balanced `{...}` starting at `start`, respecting strings.
 */
function endOfBalancedJson(s: string, start: number): number | null {
  if (s[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

/**
 * Replace progressive-disclosure JSON objects embedded in longer assistant text
 * (nested `parameterContract` objects need balanced scanning, not flat regexes).
 */
function replaceEmbeddedDisclosureJsonBlocks(s: string): string {
  if (!s.includes("REQUIRE_PARAMETERS")) return s;

  const segments: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "{") {
      i += 1;
      continue;
    }
    const end = endOfBalancedJson(s, i);
    if (end == null) {
      i += 1;
      continue;
    }
    const slice = s.slice(i, end);
    if (slice.includes("REQUIRE_PARAMETERS")) {
      try {
        const parsed = JSON.parse(slice) as unknown;
        if (looksLikeRequireParametersObject(parsed)) {
          segments.push({ start: i, end });
        }
      } catch {
        /* not valid JSON */
      }
    }
    i = end;
  }

  if (segments.length === 0) return s;
  let out = s;
  for (const seg of segments.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, seg.start) + PROGRESSIVE_DISCLOSURE_PLACEHOLDER + out.slice(seg.end);
  }
  return out;
}

/**
 * Heuristic: huge blobs mentioning REQUIRE_PARAMETERS (model pasted contract).
 */
function collapseHugeDisclosureHeuristic(s: string): string {
  if (s.length < LARGE_DISCLOSURE_MIN_LEN) return s;
  const lower = s.toLowerCase();
  if (
    lower.includes("require_parameters")
    && (lower.includes("parametercontract") || lower.includes("parameter_contract"))
  ) {
    return PROGRESSIVE_DISCLOSURE_PLACEHOLDER;
  }
  return s;
}

/**
 * Redact progressive-disclosure tool outputs from one message `content` field.
 */
export function sanitizeMessageContentForAgent(rawContent: unknown): string {
  let s = normalizeMessageContentToString(rawContent);
  if (!s) return s;

  const whole = tryReplaceWholeJsonDisclosure(s);
  if (whole != null) return whole;

  s = replaceEmbeddedDisclosureJsonBlocks(s);
  s = collapseHugeDisclosureHeuristic(s);
  return s;
}

export type HistoryEntry = { role?: string; content?: unknown; [key: string]: unknown };

/**
 * Apply {@link sanitizeMessageContentForAgent} to each message; shallow-clone entries.
 * Also filters out 'system' role messages as LLM API may not accept them in history.
 */
export function sanitizeHistoryForAgent(history: HistoryEntry[]): Array<Record<string, unknown>> {
  if (!Array.isArray(history)) return [];

  return history
    .filter((m) => {
      const role = m?.role;
      if (typeof role === 'string' && role.toLowerCase() === 'system') {
        return false;
      }
      return true;
    })
    .map((m) => {
      const next = { ...m };
      if ("content" in next) {
        next.content = sanitizeMessageContentForAgent(next.content);
      }
      return next;
    });
}
