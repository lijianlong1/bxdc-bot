import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const LOG_FILE_NAME = 'llmOrg.log';
/** Each LLM HTTP round-trip logs request + response + section row; ~10 rounds ≈ 30 array entries. */
const MAX_STORED_RECORDS = 30;
const RAW_LOG_SECTION_LABEL = '----------------调用/返回----------------';
const DEFAULT_MAX_BODY_CHARS = 512 * 1024;

/** Serialize file writes so parallel fetches do not corrupt the JSON array. */
let persistChain: Promise<void> = Promise.resolve();

function maxBodyChars(): number {
  const raw = process.env.LLM_RAW_HTTP_LOG_MAX_BODY_CHARS?.trim();
  if (!raw) return DEFAULT_MAX_BODY_CHARS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BODY_CHARS;
}

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'api-key',
  'x-api-key',
  'openai-api-key',
]);

function logsDir(): string {
  return path.join(process.cwd(), 'logs');
}

function logFilePath(): string {
  return path.join(logsDir(), LOG_FILE_NAME);
}

function ensureLogsDir(): void {
  const dir = logsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * When true, wraps the OpenAI client's fetch to write raw HTTP-ish records to logs/llmOrg.log
 * as a single JSON array (pretty-printed), with a section marker after each response and at most ~10 full round-trips kept.
 * Values: true, 1, yes, on (case-insensitive).
 */
export function isLlmRawHttpLogEnabled(): boolean {
  const v = process.env.LLM_RAW_HTTP_LOG?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/**
 * When true, POST each audit record to skill-gateway (requires JAVA_GATEWAY_URL + JAVA_GATEWAY_TOKEN).
 * Independent of local file logging; typically used with LLM_RAW_HTTP_LOG or alone for DB-only audit.
 */
export function isLlmOrgLogRemoteEnabled(): boolean {
  const v = process.env.LLM_ORG_LOG_REMOTE?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export function isLlmHttpAuditActive(): boolean {
  return isLlmRawHttpLogEnabled() || isLlmOrgLogRemoteEnabled();
}

function postRemoteAudit(payload: Record<string, unknown>): void {
  if (!isLlmOrgLogRemoteEnabled()) {
    return;
  }
  const base = process.env.JAVA_GATEWAY_URL?.trim().replace(/\/+$/, '');
  const token = process.env.JAVA_GATEWAY_TOKEN?.trim();
  if (!base || !token) {
    return;
  }
  void fetch(`${base}/api/internal/llm-http-audit/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Token': token,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* never break LLM */
  });
}

function truncateBody(text: string): { text: string; truncated: boolean } {
  const limit = maxBodyChars();
  if (text.length <= limit) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, limit)}\n...[truncated, ${text.length - limit} more chars]`,
    truncated: true,
  };
}

/** When not truncated, parse JSON bodies into objects/arrays so the log file nests real JSON. */
function tryParseJsonBody(text: string | undefined, truncated: boolean): unknown {
  if (text === undefined) return undefined;
  if (truncated) return text;
  const t = text.trim();
  if (t.length === 0) return '';
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return text;
  }
}

/**
 * Headers actually used by fetch(request, init): init headers override / add to request.headers.
 */
function effectiveRequestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  if (input instanceof Request) {
    const merged = new Headers(input.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        merged.set(key, value);
      });
    }
    return merged;
  }
  return new Headers(init?.headers);
}

function headersObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    const lk = key.toLowerCase();
    out[key] = SENSITIVE_HEADER_NAMES.has(lk) ? '[REDACTED]' : value;
  });
  return out;
}

function loadExistingRecords(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      );
    }
  } catch {
    /* not a single JSON array */
  }
  const out: Record<string, unknown>[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t) as unknown;
      if (row !== null && typeof row === 'object' && !Array.isArray(row)) {
        out.push(row as Record<string, unknown>);
      }
    } catch {
      /* skip bad legacy line */
    }
  }
  return out;
}

function sectionDividerRecord(): Record<string, unknown> {
  return {
    ts: new Date().toISOString(),
    kind: 'llmRawLogSection',
    label: RAW_LOG_SECTION_LABEL,
  };
}

function appendRecord(
  record: Record<string, unknown>,
  meta?: { userId?: string; sessionId?: string },
): void {
  if (isLlmRawHttpLogEnabled()) {
    persistChain = persistChain
      .then(() => {
        ensureLogsDir();
        const p = logFilePath();
        const prev = loadExistingRecords(p);
        prev.push(record);
        const next = prev.length > MAX_STORED_RECORDS ? prev.slice(-MAX_STORED_RECORDS) : prev;
        fs.writeFileSync(p, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      })
      .catch(() => {
        // Never break LLM calls due to logging
      });
  }

  if (isLlmOrgLogRemoteEnabled() && meta) {
    const kind = record.kind;
    if (kind === 'llmRawLogSection') {
      return;
    }
    postRemoteAudit({
      ...record,
      ...(meta.userId != null && String(meta.userId).trim() !== ''
        ? { userId: String(meta.userId).trim() }
        : {}),
      ...(meta.sessionId != null && String(meta.sessionId).trim() !== ''
        ? { sessionId: String(meta.sessionId).trim() }
        : {}),
    });
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method;
  if (input instanceof Request) return input.method;
  return 'GET';
}

async function readRequestBodyForLog(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ text: string; truncated: boolean } | undefined> {
  if (init?.body != null) {
    const b = init.body;
    if (typeof b === 'string') {
      return truncateBody(b);
    }
    if (Buffer.isBuffer(b)) {
      return truncateBody(b.toString('utf8'));
    }
    if (b instanceof ArrayBuffer) {
      return truncateBody(Buffer.from(b).toString('utf8'));
    }
    if (ArrayBuffer.isView(b)) {
      return truncateBody(Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString('utf8'));
    }
    if (typeof Blob !== 'undefined' && b instanceof Blob) {
      try {
        return truncateBody(await b.text());
      } catch {
        return { text: '[blob body unreadable]', truncated: false };
      }
    }
    return { text: '[non-buffer request body omitted: stream or FormData]', truncated: false };
  }
  if (input instanceof Request && input.body) {
    try {
      const clone = input.clone();
      const t = await clone.text();
      return truncateBody(t);
    } catch {
      return { text: '[request body unreadable]', truncated: false };
    }
  }
  return undefined;
}

async function logResponseClone(
  correlationId: string,
  response: Response,
  meta?: { userId?: string; sessionId?: string },
): Promise<void> {
  try {
    const clone = response.clone();
    const text = await clone.text();
    const { text: bodyText, truncated } = truncateBody(text);
    appendRecord(
      {
        ts: new Date().toISOString(),
        direction: 'response',
        correlationId,
        status: response.status,
        statusText: response.statusText,
        headers: headersObject(response.headers),
        contentType: response.headers.get('content-type') ?? undefined,
        body: tryParseJsonBody(bodyText, truncated),
        bodyLengthChars: bodyText.length,
        truncated,
      },
      meta,
    );
    appendRecord(sectionDividerRecord(), meta);
  } catch {
    appendRecord(
      {
        ts: new Date().toISOString(),
        direction: 'response',
        correlationId,
        status: response.status,
        statusText: response.statusText,
        body: '[failed to read response body for log]',
        truncated: false,
      },
      meta,
    );
    appendRecord(sectionDividerRecord(), meta);
  }
}

export type LlmFetchHttpLogContext = {
  userId?: string;
  sessionId?: string;
};

/**
 * Returns a fetch wrapper that logs request + response bodies to logs/llmOrg.log (JSON array, section markers, trimmed length), or undefined when disabled.
 * When `LLM_ORG_LOG_REMOTE` is set, also POSTs each record to skill-gateway (no direct DB).
 */
export function getLoggingFetchOrUndefined(
  ctx?: LlmFetchHttpLogContext,
): typeof fetch | undefined {
  if (!isLlmHttpAuditActive()) {
    return undefined;
  }

  const innerFetch: typeof fetch = globalThis.fetch.bind(globalThis);

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const correlationId = uuidv4();
    const url = resolveUrl(input);
    const method = resolveMethod(input, init);

    try {
      const effHeaders = effectiveRequestHeaders(input, init);
      const headers = headersObject(effHeaders);
      const bodyInfo = await readRequestBodyForLog(input, init);
      appendRecord(
        {
          ts: new Date().toISOString(),
          direction: 'request',
          correlationId,
          requestLine: `${method} ${url}`,
          method,
          url,
          headers,
          body: tryParseJsonBody(bodyInfo?.text, bodyInfo?.truncated ?? false),
          bodyLengthChars: bodyInfo?.text != null ? bodyInfo.text.length : undefined,
          truncated: bodyInfo?.truncated ?? false,
        },
        ctx,
      );
    } catch {
      appendRecord(
        {
          ts: new Date().toISOString(),
          direction: 'request',
          correlationId,
          method,
          url,
          body: '[failed to serialize request for log]',
          truncated: false,
        },
        ctx,
      );
    }

    const response = await innerFetch(input, init);

    void logResponseClone(correlationId, response, ctx);

    return response;
  };
}
