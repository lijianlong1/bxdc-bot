import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const LOG_FILE_NAME = 'agentRun.log';
const DEFAULT_MAX_CHARS = 512 * 1024;

function maxChars(): number {
  const raw = process.env.AGENT_RUN_RAW_LOG_MAX_CHARS?.trim();
  if (!raw) return DEFAULT_MAX_CHARS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_CHARS;
}

function logsDir(): string {
  return path.join(process.cwd(), 'logs');
}

function logFilePath(): string {
  const override = process.env.AGENT_RUN_RAW_LOG_PATH?.trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  }
  return path.join(logsDir(), LOG_FILE_NAME);
}

function ensureLogsDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * When true, appends one NDJSON line per POST /agent/run with redacted body snapshot.
 */
export function isAgentRunRawLogEnabled(): boolean {
  const v = process.env.AGENT_RUN_RAW_LOG?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[truncated-depth]';
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('apikey')
        || lowerKey.includes('api_key')
        || lowerKey.includes('token')
        || lowerKey.includes('authorization')
        || lowerKey.includes('password')
        || lowerKey.includes('secret')
      ) {
        result[key] = '[REDACTED]';
        continue;
      }
      result[key] = sanitizeValue(raw, depth + 1);
    }
    return result;
  }
  return String(value);
}

/**
 * Logs the inbound Agent run payload (instruction, context, history) for debugging.
 * Never throws into the request path.
 */
export function logAgentRunRawIfEnabled(
  body: unknown,
  meta: { sessionId?: string; userId?: string },
): void {
  if (!isAgentRunRawLogEnabled()) {
    return;
  }

  try {
    const sanitized = sanitizeValue(body);
    const payload = {
      ts: new Date().toISOString(),
      id: uuidv4(),
      route: 'POST /agent/run',
      sessionId: meta.sessionId,
      userId: meta.userId,
      body: sanitized,
    };
    const full = JSON.stringify(payload);
    const limit = maxChars();
    const line =
      full.length <= limit
        ? `${full}\n`
        : `${JSON.stringify({
          ts: payload.ts,
          id: payload.id,
          route: payload.route,
          sessionId: payload.sessionId,
          userId: payload.userId,
          truncated: true,
          totalChars: full.length,
          head: full.slice(0, limit),
        })}\n`;
    const filePath = logFilePath();
    ensureLogsDirForFile(filePath);
    fs.appendFileSync(filePath, line, 'utf8');
  } catch {
    // ignore
  }
}
