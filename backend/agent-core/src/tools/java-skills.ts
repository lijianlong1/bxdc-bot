/**
 * Java Skill Gateway 工具集合
 * 
 * 模块职责：
 * 1. 提供与 Java Skill Gateway 通信的各类工具实现
 * 2. 内置工具：SSH、API调用、数学计算、Linux脚本、服务器查询
 * 3. 支持动态加载 Gateway 扩展技能
 * 4. 实现技能确认机制（高风险操作需用户确认）
 * 5. 提供技能生成工具（通过自然语言创建新技能）
 * 
 * 内置工具列表：
 * - JavaSshTool: SSH 远程命令执行
 * - JavaApiTool: HTTP 通用代理（`api_caller`）；**当前默认不在 `AgentFactory` 中挂载**（见该类 JSDoc）
 * - JavaComputeTool: 数学计算（加减乘除、阶乘、日期计算等）
 * - JavaLinuxScriptTool: Linux 服务器脚本执行
 * - JavaServerLookupTool: 服务器信息查询
 * - JavaSkillGeneratorTool: 自然语言生成技能
 * 
 * 路由模式：
 * - legacy: 直接调用 /api/skills/* 端点
 * - gateway: 通过 /api/system-skills/execute 统一入口
 * 
 * 确认机制：
 * - 扩展技能和危险 SSH 命令需要用户确认
 * - 使用 LangGraph interrupt/Command 实现中断/恢复
 * - 确认超时时间为 5 分钟
 * 
 * 环境变量：
 * - AGENT_BUILTIN_SKILL_DISPATCH: 内置技能路由模式（legacy/gateway）
 * - AGENT_EXPOSE_SSH_EXECUTOR: 是否暴露 SSH 执行器
 * 
 * @module JavaSkills
 * @author Agent Core Team
 * @since 1.0.0
 */

import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { interrupt, isGraphInterrupt } from "@langchain/langgraph";
import {
  DynamicTool,
  Tool,
  DynamicStructuredTool,
  StructuredTool,
  isStructuredTool,
} from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { pinyin } from "pinyin-pro";

/**
 * AJV 实例，用于 JSON Schema 验证
 * 
 * 配置：
 * - allErrors: 返回所有验证错误
 * - useDefaults: 自动填充默认值
 */
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

/** Built-in 工具调用路径：`legacy` 直连 `/api/skills/*`；`gateway` 经 `/api/system-skills/execute`（见 OpenSpec unified-skill-db-agent-thin）。扩展 Skill 不受此开关影响。 */
export function getAgentBuiltinSkillDispatch(): "legacy" | "gateway" {
  const v = (process.env.AGENT_BUILTIN_SKILL_DISPATCH ?? "legacy").trim().toLowerCase();
  return v === "gateway" ? "gateway" : "legacy";
}

export type BuiltinSkillDispatch = "legacy" | "gateway";

/* ====================== Zod Schemas (must be before any class that uses them) ====================== */

const COMPUTE_OPERATIONS = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "factorial",
  "square",
  "sqrt",
  "timestamp_to_date",
  "date_diff_days",
] as const;

/** Exported for gateway-dispatch builtin tools (same shapes as legacy Java*Tool). */
export const computeToolInputSchema = z.object({
  operation: z
    .enum(COMPUTE_OPERATIONS)
    .describe(
      "add|subtract|multiply|divide: two numbers in operands. factorial|square|sqrt: one number. timestamp_to_date: one Unix timestamp (seconds or ms). date_diff_days: two calendar dates as YYYY-MM-DD strings.",
    ),
  operands: z
    .array(z.union([z.number(), z.string()]))
    .min(1)
    .describe(
      "add: [3,5]. subtract|multiply|divide: [a,b]. factorial|square|sqrt: [n]. timestamp_to_date: [unixTs]. date_diff_days: [\"2026-03-08\",\"2026-03-12\"].",
    ),
});

const serverLookupToolInputSchema = z.object({
  serverName: z
    .string()
    .min(1)
    .describe("User-visible server name to search; returns up to 5 candidate serverId values (no credentials)."),
});

const linuxScriptToolInputSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .describe("Server ledger id from server_lookup.candidates[].id"),
  command: z
    .string()
    .min(1)
    .describe("Shell command to execute on the server"),
});

export const apiCallerToolInputSchema = z.object({
  url: z.string().url().describe("Full target URL"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .default("GET")
    .describe("HTTP method"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Additional headers (Authorization, Content-Type, etc.)"),
  body: z
    .any()
    .optional()
    .describe("Request body (object, string, or null)"),
});

export const sshExecutorToolInputSchema = z.object({
  host: z.string().min(1).describe("SSH host (IP or hostname)"),
  username: z.string().min(1).describe("SSH username"),
  command: z.string().min(1).describe("Shell command to execute"),
  privateKey: z.string().optional().describe("Private key content (PEM format) - mutually exclusive with password"),
  password: z.string().optional().describe("Password for authentication - mutually exclusive with privateKey"),
  confirmed: z
    .boolean()
    .default(false)
    .describe("Set to true to skip confirmation for potentially dangerous commands (rm -rf, reboot, etc.)"),
});

/** Models often send "true"/"false" as strings; coerce so structured tool validation does not loop on schema errors. */
const skillGeneratorAllowOverwriteSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no" || v === "") return false;
  }
  return val;
}, z.boolean().optional().default(false));

/** LLMs often stringify nested JSON for headers/query/testInput — parse so Zod receives objects. */
function parseJsonObjectString(val: unknown): unknown {
  if (val === undefined || val === null) return val;
  if (typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return undefined;
    try {
      const p = JSON.parse(t) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p;
    } catch {
      return val;
    }
  }
  return val;
}

const skillGeneratorHeadersSchema = z.preprocess(
  (val) => parseJsonObjectString(val),
  z.record(z.string()).optional(),
);

const skillGeneratorQuerySchema = z.preprocess(
  (val) => parseJsonObjectString(val),
  z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
);

const skillGeneratorTestInputSchema = z.preprocess(
  (val) => parseJsonObjectString(val),
  z.record(z.unknown()).optional(),
);

/** parameterContract may be a JSON string or object (models often stringify nested schema). */
const skillGeneratorParameterContractSchema = z.preprocess(
  (val) => parseJsonObjectString(val),
  z.any().optional(),
);

const skillGeneratorBooleanOptionalSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no" || v === "") return false;
  }
  return val;
}, z.boolean().optional());

const skillGeneratorTimeoutSecondsSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val.trim());
    if (Number.isFinite(n)) return n;
  }
  return val;
}, z.number().int().min(1).max(3600).optional());

const skillGeneratorAsyncPollSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val.trim()) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p;
    } catch {
      return val;
    }
  }
  return val;
}, z.object({
  pollEndpoint: z.string().optional(),
  idJsonPath: z.string().optional(),
  pollMethod: z.string().optional(),
  pollIntervalSeconds: z.number().int().min(1).optional(),
  maxWaitSeconds: z.number().int().min(1).optional(),
  completionJsonPath: z.string().optional(),
  completionValue: z.string().optional(),
  failedValues: z.array(z.string()).optional(),
  resultJsonPath: z.string().optional(),
  pollHeaders: z.record(z.string()).optional(),
  // 新增：轮询策略。'PERIODIC' = 周期轮询（默认，需要 pollEndpoint）；
  // 'SINGLE_CALL' = 单次长调用（不依赖 pollEndpoint，长 readTimeout 等最终结果）。
  pollStrategy: z.enum(["PERIODIC", "SINGLE_CALL"]).optional(),
  // SINGLE_CALL 专用 read timeout（秒）。未设置时回退到 maxWaitSeconds。
  singleCallReadTimeoutSeconds: z.number().int().min(1).optional(),
}).optional());

/** Skill generator schema - flat object with optional fields for all target types */
const skillGeneratorToolInputSchema = z.object({
  targetType: z.enum(["api", "ssh", "openclaw", "template"]).describe("Type of skill to create."),
  // Common fields
  rawDescription: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  allowOverwrite: skillGeneratorAllowOverwriteSchema,
  // API fields
  method: z.string().optional(),
  endpoint: z.string().optional(),
  headers: skillGeneratorHeadersSchema,
  query: skillGeneratorQuerySchema,
  body: z.any().optional(),
  interfaceDescription: z.string().optional(),
  parameterContract: skillGeneratorParameterContractSchema
    .describe("JSON Schema object describing API parameters. Each property supports: "
      + "type/description/required/default (standard JSON Schema), "
      + "enum: string[] OR [{label:string, value:string}][] (simple values or with display labels), "
      + "enumSource (optional): { url, method? (default GET), headers?, jsonPath?, valueKey? (default 'value'), labelKey? (default 'label'), searchParam?, refreshIntervalSec? (default 300) } "
      + "for dynamic dropdown options fetched from an API."),
  parameterBinding: z.enum(["query", "jsonBody", "formBody"]).optional()
    .describe("How scalar parameters map to the HTTP call: query (URL params), jsonBody (JSON request body), formBody (application/x-www-form-urlencoded). Default: jsonBody for POST/PUT/PATCH/DELETE, query for GET/HEAD."),
  timeoutSeconds: skillGeneratorTimeoutSecondsSchema
    .describe("HTTP timeout in seconds (1-3600). Default 30. Set higher (e.g. 120) for slow APIs; for minute-to-hour long tasks, set asyncPoll instead."),
  asyncPoll: skillGeneratorAsyncPollSchema
    .describe("Async polling configuration for long-running APIs that return a task ID and require status polling. "
        + "Rules: pollEndpoint MUST contain {id} placeholder; JSON paths use dot notation (e.g. data.status) — NEVER use $ prefix; "
        + "only valid fields are: pollEndpoint, idJsonPath, pollMethod, pollIntervalSeconds, maxWaitSeconds, completionJsonPath, completionValue, failedValues, resultJsonPath, pollHeaders"),
  testInput: skillGeneratorTestInputSchema,
  enabled: skillGeneratorBooleanOptionalSchema,
  requiresConfirmation: skillGeneratorBooleanOptionalSchema,
  // SSH fields
  command: z.string().optional(),
  // OPENCLAW fields
  systemPrompt: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  // Template fields
  prompt: z.string().optional(),
});

import {
  emitToolTraceEvent,
  getActiveParentToolId,
  sanitizeToolTraceArguments,
  sanitizeToolResultForTrace,
} from "./tool-trace-context";

export function formatToolError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseBody = error.response?.data;
    const baseMessage = error.message || 'Axios request failed';
    const statusPart = status ? ` (status ${status})` : '';

    if (typeof responseBody === 'string' && responseBody.trim()) {
      return `${baseMessage}${statusPart}: ${responseBody.trim()}`;
    }
    if (responseBody && typeof responseBody === 'object') {
      try {
        return `${baseMessage}${statusPart}: ${JSON.stringify(responseBody)}`;
      } catch {
        return `${baseMessage}${statusPart}`;
      }
    }
    return `${baseMessage}${statusPart}`;
  }

  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export interface GatewaySkill {
  id: number;
  name: string;
  description?: string;
  type?: string;
  executionMode?: string;
  configuration?: string;
  enabled?: boolean;
  requiresConfirmation?: boolean;
  visibility?: string;
  createdBy?: string;
  /** Display emoji; persisted by Skill Gateway */
  avatar?: string;
}

export interface SkillMutationPayload {
  name: string;
  description: string;
  type: "EXTENSION";
  executionMode?: "CONFIG" | "OPENCLAW";
  configuration: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  visibility?: "PUBLIC" | "PRIVATE";
  avatar?: string;
}

export interface ExtendedSkillConfig {
  kind?: string;
  preset?: string;
  profile?: string;
  operation?: string;
  lookup?: string;
  executor?: string;
  method?: string;
  endpoint?: string;
  command?: string;
  systemPrompt?: string;
  inputGuidance?: string;
  allowedTools?: string[];
  orchestration?: {
    mode?: string;
  };
  prompt?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  /** HTTP 超时秒数，默认 30；同时作用于 Agent Core → Gateway 和 Gateway → 外部 API 两段 */
  timeoutSeconds?: number;
  /** 异步轮询配置，存在时走异步路径 */
  asyncPoll?: AsyncPollConfig;
  /**
   * How merged scalar contract fields map to the outbound HTTP call (after `parameterContract` validation).
   * - `query` (default): append scalars to URL query; `merged.body` alone is the proxy body (legacy).
   * - `jsonBody`: send scalars as JSON object in the proxy body (POST/PUT/PATCH/DELETE); GET/HEAD falls back to `query`.
   * - `formBody`: send flat scalars as `application/x-www-form-urlencoded` body; GET/HEAD falls back to `query`.
   */
  parameterBinding?: "query" | "jsonBody" | "formBody";
  interfaceDescription?: string;
  parameterContract?: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      required?: boolean;
      enum?: string[];
      default?: any;
    }>;
    required?: string[];
  };
}

export interface AsyncPollConfig {
  /** 轮询端点模板，{id} 会被替换为外部任务 ID。SINGLE_CALL 模式下可省略（fallback 到请求 URL）。 */
  pollEndpoint?: string;
  /** 从初始响应中提取任务 ID 的 JSON 路径，如 "data.task_id"。SINGLE_CALL 模式下不需要。 */
  idJsonPath?: string;
  /** 轮询 HTTP method，默认 GET */
  pollMethod?: string;
  /** 轮询间隔（毫秒），默认 5000 */
  pollIntervalMs?: number;
  /** 轮询间隔（秒），优先于 pollIntervalMs */
  pollIntervalSeconds?: number;
  /** 最大等待时间（毫秒），默认 600000（10分钟） */
  maxWaitMs?: number;
  /** 最大等待时间（秒），优先于 maxWaitMs */
  maxWaitSeconds?: number;
  /** 判断完成的 JSON 路径 */
  completionJsonPath?: string;
  /** 完成时的字段值 */
  completionValue?: string;
  /** 失败状态的字段值列表 */
  failedValues?: string[];
  /** 结果提取的 JSON 路径 */
  resultJsonPath?: string;
  /** 轮询请求头 */
  pollHeaders?: Record<string, string>;
  /**
   * 轮询策略：
   * - 'PERIODIC'（默认）：周期轮询，需要 pollEndpoint 包含 {id} 占位符。
   * - 'SINGLE_CALL'：单次长调用（无 pollEndpoint 也可以，靠长 readTimeout 等结果）；
   *                 提交后立即返回 asyncTaskId，LLM 异步获知结果。
   */
  pollStrategy?: "PERIODIC" | "SINGLE_CALL";
  /** SINGLE_CALL 模式专用 read timeout（秒）。未设置时回退到 maxWaitSeconds。 */
  singleCallReadTimeoutSeconds?: number;
}

export function readPreset(config: ExtendedSkillConfig): string | undefined {
  const value = config.preset ?? config.profile;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function isCurrentTimeSkillConfig(config: ExtendedSkillConfig): boolean {
  const kind = (config.kind || "").toLowerCase();
  const operation = (config.operation || "").toLowerCase();
  const preset = (readPreset(config) || "").toLowerCase();
  return (
    kind === "time" // legacy
    || (kind === "api" && (preset === "current-time" || operation === "current-time"))
    || operation === "current-time"
  );
}

function isServerMonitorSkillConfig(config: ExtendedSkillConfig): boolean {
  const kind = (config.kind || "").toLowerCase();
  const operation = (config.operation || "").toLowerCase();
  const preset = (readPreset(config) || "").toLowerCase();
  return (
    kind === "monitor" // legacy
    || (kind === "ssh" && (preset === "server-resource-status" || operation === "server-resource-status"))
    || operation === "server-resource-status"
  );
}

/** Extended on-server command skill (server-resource-status): ledger id from server_lookup; command is in skill config. */
const extendedSshSkillToolSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .describe("Server ledger id from server_lookup.candidates[].id after disambiguation when needed."),
});

const extendedTemplateSkillToolSchema = z.object({
  input: z.string().optional().describe("User message or parameters for this template skill."),
});

const extendedOpenClawSkillToolSchema = z.object({
  input: z.string().optional().describe("User goal or parameters for the OPENCLAW planner."),
});

/**
 * 包装 zod schema 以保证 JSON Schema 顶层一定有 `type: "object"`，兼容 DeepSeek 严格校验。
 * 对于 z.object({}).passthrough() 这种"空对象"类型，LangChain 转换出的 JSON Schema
 * 不会自动加 type: "object"，DeepSeek 会返回 400 错误。
 * 这里在外层加一个虚拟字段 `payload` 来强制生成 type: "object"。
 */
function ensureObjectType<T extends z.ZodTypeAny>(inner: T, description: string): z.ZodType<{ payload?: unknown }> {
  return z.object({ payload: inner.optional().describe(description) }).passthrough() as any;
}

const extendedApiSkillLooseSchema = ensureObjectType(
  z.object({}).passthrough(),
  "API parameters as a single object. Must match the skill parameter contract (JSON Schema). "
    + "Defaults from the contract apply when keys are omitted."
);

const extendedPassthroughSkillToolSchema = ensureObjectType(
  z.object({}).passthrough(),
  "Free-form skill input (object, string, or array)."
);

const extendedSkillConfirmationField = z.object({
  confirmed: z
    .boolean()
    .optional()
    .describe("Set by the confirmation UI when resuming; omit for normal calls."),
});

function withOptionalConfirmationFlag(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    return schema.merge(extendedSkillConfirmationField);
  }
  return z.intersection(schema, extendedSkillConfirmationField);
}

function buildExtendedSkillZodSchema(config: ExtendedSkillConfig): z.ZodTypeAny {
  let inner: z.ZodTypeAny;
  if (isCurrentTimeSkillConfig(config)) {
    inner = extendedPassthroughSkillToolSchema;
  } else if (isServerMonitorSkillConfig(config)) {
    inner = extendedSshSkillToolSchema;
  } else {
    const executionMode = (config as { orchestration?: { mode?: string } }).orchestration?.mode;
    if (executionMode === "OPENCLAW" || (config.kind || "").toLowerCase() === "openclaw") {
      inner = extendedOpenClawSkillToolSchema;
    } else if ((config.kind || "").toLowerCase() === "template") {
      inner = extendedTemplateSkillToolSchema;
    } else if (
      (config.kind || "").toLowerCase() === "api"
      || config.operation === "api-request"
      || config.operation === "juhe-joke-list"
    ) {
      inner = extendedApiSkillLooseSchema;
    } else {
      inner = extendedPassthroughSkillToolSchema;
    }
  }
  return withOptionalConfirmationFlag(inner);
}

interface SkillGeneratorInput {
  targetType?: "api" | "ssh" | "openclaw" | "template";
  rawDescription?: string;
  name?: string;
  description?: string;
  // API specific
  method?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  interfaceDescription?: string;
  parameterContract?: any;
  parameterBinding?: "query" | "jsonBody" | "formBody";
  timeoutSeconds?: number;
  asyncPoll?: AsyncPollConfig;
  // SSH specific
  command?: string;
  // OPENCLAW specific
  systemPrompt?: string;
  allowedTools?: string[];
  // Template specific
  prompt?: string;
  // Common
  testInput?: Record<string, unknown>;
  enabled?: boolean;
  requiresConfirmation?: boolean;
  allowOverwrite?: boolean;
}

interface GatewayToolMetadata {
  displayName: string;
  executionMode?: string;
  executionLabel?: string;
}

const gatewayExtendedToolRegistry = new Map<string, GatewayToolMetadata>();
const gatewayExtendedToolIdRegistry = new Map<number, GatewayToolMetadata>();

function normalizeToolName(name: string, id: number): string {
  let processedName = name;
  if (/[\u4e00-\u9fff]/.test(name)) {
    try {
      processedName = pinyin(name, { toneType: "none", type: "array" }).join(" ");
    } catch {
      processedName = name;
    }
  }
  const normalized = processedName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefix = "extended_";
  const maxLen = 64 - prefix.length;
  const truncated = normalized.substring(0, maxLen).replace(/_+$/, "");
  return truncated ? `${prefix}${truncated}` : `extended_skill_${id}`;
}

function normalizeExecutionMode(executionMode?: string): "CONFIG" | "OPENCLAW" {
  return executionMode?.toUpperCase() === "OPENCLAW" ? "OPENCLAW" : "CONFIG";
}

function localizeExecutionMode(executionMode?: string): "预配置" | "自主规划" {
  return normalizeExecutionMode(executionMode) === "OPENCLAW" ? "自主规划" : "预配置";
}

function registerGatewayToolMetadata(toolName: string, skill: GatewaySkill) {
  const metadata: GatewayToolMetadata = {
    displayName: skill.name || `skill_${skill.id}`,
    executionMode: normalizeExecutionMode(skill.executionMode),
    executionLabel: localizeExecutionMode(skill.executionMode),
  };

  gatewayExtendedToolRegistry.set(toolName, metadata);
  gatewayExtendedToolRegistry.set(toolName.replace(/_/g, "-"), metadata);
  gatewayExtendedToolIdRegistry.set(skill.id, metadata);
}

export function describeGatewayExtendedTool(toolName: string): { displayName: string; kind: 'skill' | 'tool'; executionMode?: string; executionLabel?: string } | null {
  const metadata =
    gatewayExtendedToolRegistry.get(toolName)
    ?? gatewayExtendedToolRegistry.get(toolName.replace(/-/g, "_"))
    ?? gatewayExtendedToolRegistry.get(toolName.replace(/_/g, "-"));

  if (metadata) {
    return {
      displayName: metadata.displayName,
      kind: 'skill',
      executionMode: metadata.executionMode,
      executionLabel: metadata.executionLabel,
    };
  }

  // Fallback: resolve by trailing numeric id (e.g. extended-skill-1 / extended_skill_1)
  const idMatch = toolName.match(/(\d+)$/);
  if (!idMatch) return null;
  const skillId = Number(idMatch[1]);
  if (!Number.isFinite(skillId)) return null;
  const idDisplayName = gatewayExtendedToolIdRegistry.get(skillId);
  if (!idDisplayName) return null;
  return {
    displayName: idDisplayName.displayName,
    kind: 'skill',
    executionMode: idDisplayName.executionMode,
    executionLabel: idDisplayName.executionLabel,
  };
}

export function normalizeParameterBindingValue(raw: unknown): "query" | "jsonBody" | "formBody" | undefined {
  if (raw === "jsonBody" || raw === "query" || raw === "formBody") return raw;
  return undefined;
}

export function normalizeExtendedConfig(cfg: ExtendedSkillConfig): ExtendedSkillConfig {
  const next: ExtendedSkillConfig = { ...cfg };
  const pb = normalizeParameterBindingValue((cfg as { parameterBinding?: unknown }).parameterBinding);
  if (pb) {
    next.parameterBinding = pb;
  } else {
    delete (next as { parameterBinding?: unknown }).parameterBinding;
  }
  const rawPc = (cfg as { parameterContract?: unknown }).parameterContract;
  if (typeof rawPc === "string" && rawPc.trim()) {
    try {
      const parsed = JSON.parse(rawPc) as ExtendedSkillConfig["parameterContract"];
      if (parsed && typeof parsed === "object") {
        next.parameterContract = parsed as ExtendedSkillConfig["parameterContract"];
      }
    } catch {
      // keep original
    }
  }
  return next;
}

export function parseSkillConfig(skill: GatewaySkill): ExtendedSkillConfig {
  if (!skill.configuration || !skill.configuration.trim()) return {};
  try {
    const parsed = JSON.parse(skill.configuration);
    if (!parsed || typeof parsed !== "object") return {};
    return normalizeExtendedConfig(parsed as ExtendedSkillConfig);
  } catch {
    return {};
  }
}

const LLM_API_SKILL_STRUCTURED_HINT =
  "Tool call: pass parameters as **top-level** fields matching the parameter contract below (structured tool schema). "
  + "Do not nest the whole payload under a single `input` string.\n\n";

function appendInterfaceDescriptionTail(base: string, config: ExtendedSkillConfig): string {
  const extra = config.interfaceDescription?.trim();
  if (!extra) return base;
  return base.includes(extra) ? base : `${base}\n\n${extra}`;
}

function appendParameterContractToToolDescription(
  baseDescription: string,
  config: ExtendedSkillConfig,
): string {
  const contract = config.parameterContract as Record<string, unknown> | undefined;
  if (!contract || typeof contract !== "object") {
    return appendInterfaceDescriptionTail(baseDescription, config);
  }

  const props = contract.type === "object"
    && contract.properties
    && typeof contract.properties === "object"
    && !Array.isArray(contract.properties)
    ? (contract.properties as Record<string, { type?: string; description?: string; enum?: string[]; default?: unknown }>)
    : null;

  if (props && Object.keys(props).length > 0) {
    const requiredList = Array.isArray(contract.required) ? contract.required as string[] : [];
    const lines = Object.entries(props)
      .map(([key, prop]) => {
        const req = requiredList.includes(key) ? " (required)" : "";
        const desc = prop?.description ? `: ${prop.description}` : "";
        const type = prop?.type ? ` [${prop.type}]` : "";
        const enums = Array.isArray(prop?.enum) ? ` (enum: ${prop.enum.join(", ")})` : "";
        const def = prop?.default !== undefined ? ` (default: ${JSON.stringify(prop.default)})` : "";
        return `  - ${key}${req}${type}${desc}${enums}${def}`;
      })
      .join("\n");
    return appendInterfaceDescriptionTail(
      `${baseDescription}\n\n${LLM_API_SKILL_STRUCTURED_HINT}Parameters:\n${lines}`,
      config,
    );
  }

  try {
    return appendInterfaceDescriptionTail(
      `${baseDescription}\n\n${LLM_API_SKILL_STRUCTURED_HINT}Parameter contract (JSON Schema):\n${JSON.stringify(contract, null, 2)}`,
      config,
    );
  } catch {
    return appendInterfaceDescriptionTail(baseDescription, config);
  }
}

function parseCheckTimePayload(payload: unknown): { timestamp: number; isoTime: string } | null {
  if (typeof payload === "string") {
    const match = payload.match(/QZOutputJson=\{.*?"t"\s*:\s*"?(?<ts>\d{10,13})"?/);
    const tsRaw = match?.groups?.ts;
    if (!tsRaw) return null;
    const tsNum = Number(tsRaw);
    if (!Number.isFinite(tsNum)) return null;
    const timestampMs = tsNum < 1e12 ? tsNum * 1000 : tsNum;
    return { timestamp: tsNum, isoTime: new Date(timestampMs).toISOString() };
  }

  if (payload && typeof payload === "object") {
    const direct = (payload as Record<string, unknown>).t;
    if (typeof direct === "string" || typeof direct === "number") {
      const tsNum = Number(direct);
      if (Number.isFinite(tsNum)) {
        const timestampMs = tsNum < 1e12 ? tsNum * 1000 : tsNum;
        return { timestamp: tsNum, isoTime: new Date(timestampMs).toISOString() };
      }
    }
  }

  return null;
}

function parseToolInput(input: string): Record<string, unknown> {
  if (!input?.trim()) return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * LLMs often pass API args as a JSON string under `input` (legacy string tool shape).
 * Unwrap so query params match the skill contract (type, key, page, …).
 */
function normalizeApiSkillPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  const rawInput = next.input;
  if (typeof rawInput === "string" && rawInput.trim()) {
    try {
      const inner = JSON.parse(rawInput.trim()) as unknown;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        delete next.input;
        return { ...(inner as Record<string, unknown>), ...next };
      }
    } catch {
      // not JSON — keep `input` as-is (e.g. free-text)
    }
  }
  return next;
}

function pushScalarDefault(
  out: Record<string, string | number | boolean>,
  key: string,
  value: unknown,
): void {
  if (value === undefined) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out[key] = value;
  }
}

function normalizeEnumForValidation(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'value' in item) return (item as { value: unknown }).value;
    return item;
  });
}

export function normalizeParameterContractRequired(contract: Record<string, unknown>): Record<string, unknown> {
  const out = { ...contract };
  const props = out.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return out;

  const existingRequired = Array.isArray(out.required) ? (out.required as string[]) : [];
  const requiredSet = new Set(existingRequired);
  const normalizedProps: Record<string, Record<string, unknown>> = {};

  for (const [key, prop] of Object.entries(props)) {
    const p = { ...prop };
    if (p.required === true) {
      requiredSet.add(key);
      delete p.required;
    }
    normalizedProps[key] = p;
  }

  out.properties = normalizedProps;
  if (requiredSet.size > 0) {
    out.required = Array.from(requiredSet);
  } else {
    delete out.required;
  }
  return out;
}

function normalizeParameterContractForValidation(contract: Record<string, unknown>): Record<string, unknown> {
  let out = normalizeParameterContractRequired(contract);
  const props = out.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return out;
  const normalizedProps: Record<string, Record<string, unknown>> = {};
  for (const [key, prop] of Object.entries(props)) {
    const p = { ...prop };
    if (Array.isArray(p.enum)) {
      p.enum = normalizeEnumForValidation(p.enum);
    }
    if (p.enumSource !== undefined) {
      delete p.enumSource;
    }
    normalizedProps[key] = p;
  }
  out.properties = normalizedProps;
  return out;
}

/**
 * Collect default values from JSON Schema (`type` + `properties`) or gateway flat maps
 * (`{ paramName: { type, default, ... } }`). Merged before the tool payload so callers
 * need not repeat fixed keys (e.g. API key) in every tool call.
 */
function collectParameterDefaults(parameterContract: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!parameterContract || typeof parameterContract !== "object" || Array.isArray(parameterContract)) {
    return out;
  }
  const pc = parameterContract as Record<string, unknown>;

  if (
    pc.type === "object"
    && pc.properties
    && typeof pc.properties === "object"
    && !Array.isArray(pc.properties)
  ) {
    const props = pc.properties as Record<string, { default?: unknown }>;
    for (const [key, spec] of Object.entries(props)) {
      if (!spec || typeof spec !== "object") continue;
      pushScalarDefault(out, key, spec.default);
    }
    return out;
  }

  for (const [key, spec] of Object.entries(pc)) {
    if (key === "required" && Array.isArray(spec)) continue;
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) continue;
    pushScalarDefault(out, key, (spec as { default?: unknown }).default);
  }
  return out;
}

export function normalizeGeneratedOperation(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "api_request";
}

function deriveSkillName(input: SkillGeneratorInput): string {
  if (typeof input.name === "string" && input.name.trim()) {
    return input.name.trim();
  }

  if (input.targetType === "api" && typeof input.endpoint === "string" && input.endpoint.trim()) {
    try {
      const url = new URL(input.endpoint);
      const pathPart = url.pathname
        .split("/")
        .filter(Boolean)
        .slice(-2)
        .join(" ");
      const hostPart = url.hostname.replace(/^www\./, "");
      const candidate = `${hostPart} ${pathPart}`.trim();
      if (candidate) return `API ${candidate}`;
    } catch {
      // Ignore invalid endpoint here, validation happens separately.
    }
  }

  if (input.targetType === "ssh" && typeof input.command === "string" && input.command.trim()) {
    const firstWord = input.command.trim().split(/\s+/)[0];
    if (firstWord) return `SSH ${firstWord}`;
  }

  if (input.targetType === "openclaw") {
    return "Generated OPENCLAW Skill";
  }

  if (input.targetType === "template") {
    return "Generated Template Skill";
  }

  return "Generated Skill";
}

function deriveSkillDescription(input: SkillGeneratorInput, name: string): string {
  if (typeof input.description === "string" && input.description.trim()) {
    return input.description.trim();
  }

  if (typeof input.rawDescription === "string" && input.rawDescription.trim()) {
    return input.rawDescription.trim();
  }

  if (input.targetType === "api") {
    const method = typeof input.method === "string" ? input.method.toUpperCase() : "API";
    const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
    const inputHint = "调用时将请求参数合并为一个 JSON 对象，再序列化为字符串传入工具的 `input` 参数。";
    return endpoint ? `${name}。通过 ${method} ${endpoint} 发起请求。${inputHint}` : `${name}。${inputHint}`;
  }

  if (input.targetType === "ssh") {
    return `${name}。在服务器上执行命令。`;
  }

  if (input.targetType === "openclaw") {
    return `${name}。自主规划执行任务。`;
  }

  if (input.targetType === "template") {
    return `${name}。可复用的提示词模板。`;
  }

  return name;
}

export function sanitizeConfigForDisplay(config: ExtendedSkillConfig): ExtendedSkillConfig {
  return config;
}

function buildValidationSummary(result: string): {
  success: boolean;
  parsed?: unknown;
  raw?: string;
  error?: string;
} {
  if (result.startsWith("Error ")) {
    return {
      success: false,
      error: result,
    };
  }

  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)) {
      return {
        success: false,
        parsed,
        error: String((parsed as Record<string, unknown>).error || "Validation failed"),
      };
    }

    return {
      success: true,
      parsed,
    };
  } catch {
    return {
      success: true,
      raw: result,
    };
  }
}

function buildGeneratedSkill(input: SkillGeneratorInput): {
  missingFields: string[];
  skillPayload?: SkillMutationPayload;
  config?: ExtendedSkillConfig;
  validationInput?: Record<string, unknown>;
} {
  const missingFields: string[] = [];
  const targetType = input.targetType || "api";

  if (targetType === "api") {
    const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
    const method = typeof input.method === "string" ? input.method.trim().toUpperCase() : "";

    if (!endpoint) missingFields.push("endpoint");
    if (!method) missingFields.push("method");
    if (!input.interfaceDescription?.trim()) missingFields.push("interfaceDescription");
    if (!input.parameterContract) missingFields.push("parameterContract");

    if (endpoint) {
      try {
        new URL(endpoint);
      } catch {
        missingFields.push("endpoint(valid URL)");
      }
    }
  } else if (targetType === "ssh") {
    if (!input.command?.trim()) {
      missingFields.push("command");
    }
  } else if (targetType === "openclaw") {
    if (!input.systemPrompt?.trim()) {
      missingFields.push("systemPrompt");
    }
  } else if (targetType === "template") {
    if (!input.prompt?.trim()) {
      missingFields.push("prompt");
    }
  } else {
    missingFields.push("targetType(api|ssh|openclaw|template)");
  }

  if (missingFields.length > 0) {
    return { missingFields };
  }

  function pickGeneratedSkillAvatar(kind: string): string {
    switch (kind) {
      case "api":
        return "🔌";
      case "ssh":
        return "🐧";
      case "openclaw":
        return "✨";
      case "template":
        return "📝";
      default:
        return "🧩";
    }
  }

  const name = deriveSkillName({ ...input, targetType });
  const description = deriveSkillDescription({ ...input, targetType }, name);
  let config: ExtendedSkillConfig = {};
  let executionMode: "CONFIG" | "OPENCLAW" = "CONFIG";

  if (targetType === "api") {
    const rawPc = input.parameterContract;
    let parameterContract = typeof rawPc === "string"
      ? (() => { try { const p = JSON.parse(rawPc); return (p && typeof p === "object") ? p : rawPc; } catch { return rawPc; } })()
      : rawPc;
    if (parameterContract && typeof parameterContract === "object" && !Array.isArray(parameterContract)) {
      parameterContract = normalizeParameterContractRequired(parameterContract as Record<string, unknown>);
    }

    const methodUpper = typeof input.method === "string" ? input.method.trim().toUpperCase() : "";
    /** POST/PUT/PATCH/DELETE: flat `parameterContract` fields default to JSON body (see `executeConfiguredApiSkill`).
        LLM can override via `input.parameterBinding` (e.g. "formBody" for form-encoded APIs). */
    const resolvedBinding = normalizeParameterBindingValue(input.parameterBinding)
      ?? (["POST", "PUT", "PATCH", "DELETE"].includes(methodUpper) ? "jsonBody" as const : undefined);
    config = {
      kind: "api",
      operation: normalizeGeneratedOperation(name),
      method: input.method?.trim().toUpperCase(),
      endpoint: input.endpoint?.trim(),
      ...(resolvedBinding ? { parameterBinding: resolvedBinding } : {}),
      ...(input.headers && Object.keys(input.headers).length > 0 ? { headers: input.headers } : {}),
      ...(input.query && Object.keys(input.query).length > 0 ? { query: input.query } : {}),
      ...(input.interfaceDescription?.trim() ? { interfaceDescription: input.interfaceDescription.trim() } : {}),
      ...(parameterContract ? { parameterContract } : {}),
      ...(input.timeoutSeconds !== undefined && input.timeoutSeconds !== 30 ? { timeoutSeconds: input.timeoutSeconds } : {}),
      ...(input.asyncPoll ? { asyncPoll: input.asyncPoll } : {}),
    };
  } else if (targetType === "ssh") {
    config = {
      kind: "ssh",
      preset: "server-resource-status",
      operation: "server-resource-status",
      lookup: "server_lookup",
      executor: "linux_script_executor",
      command: input.command?.trim(),
      interfaceDescription:
        "Two-step: (1) server_lookup with `serverName` to get up to 5 candidates (`id` + `name`); if one, use its `id`; if several, ask the user, then (2) call this tool with top-level `id` only. "
        + "The shell command is fixed in this skill configuration and is not a tool parameter.",
    };
  } else if (targetType === "openclaw") {
    executionMode = "OPENCLAW";
    config = {
      kind: "openclaw",
      systemPrompt: input.systemPrompt?.trim(),
      allowedTools: input.allowedTools || [],
      orchestration: { mode: "serial" },
    };
  } else if (targetType === "template") {
    config = {
      kind: "template",
      prompt: input.prompt?.trim(),
    };
  }

  const validationInput = input.testInput || {
    ...(config.query ? { query: config.query } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
  };

  return {
    missingFields,
    config,
    validationInput,
    skillPayload: {
      name,
      description,
      type: "EXTENSION",
      executionMode,
      configuration: JSON.stringify(config),
      enabled: input.enabled ?? true,
      requiresConfirmation: input.requiresConfirmation ?? false,
      visibility: "PRIVATE",
      avatar: pickGeneratedSkillAvatar(targetType),
    },
  };
}

function toQueryRecord(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string | number | boolean>>((acc, [key, item]) => {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      acc[key] = item;
    }
    return acc;
  }, {});
}

function buildUrlWithQuery(endpoint: string, query: Record<string, string | number | boolean>): string {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function executeCurrentTimeSkill(
  gatewayUrl: string,
  apiToken: string,
  userId: string | undefined,
  config: ExtendedSkillConfig,
  skillId?: number,
): Promise<string> {
  const endpoint = config.endpoint || "https://vv.video.qq.com/checktime?otype=json";
  const method = (config.method || "GET").toUpperCase();
  const response = await axios.post(
    `${gatewayUrl}/api/skills/api`,
    {
      url: endpoint,
      method,
      headers: {},
      body: "",
    },
    {
      headers: gatewayApiProxyInboundHeaders(apiToken, userId, skillId),
    }
  );

  const parsed = parseCheckTimePayload(response.data);
  if (!parsed) {
    return JSON.stringify({
      error: "Failed to parse current time response",
      raw: response.data,
    });
  }

  return JSON.stringify({
    timestamp: parsed.timestamp,
    readableTime: parsed.isoTime,
  });
}

function parseSshSkillPayload(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return { ...(input as Record<string, unknown>) };
  }
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return {};
    try {
      const parsed = JSON.parse(t) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { id: t };
    } catch {
      return { id: t };
    }
  }
  return {};
}

async function executeServerResourceStatusSkill(
  gatewayUrl: string,
  apiToken: string,
  userId: string | undefined,
  input: unknown,
  config: ExtendedSkillConfig,
  skillId?: number,
): Promise<string> {
  const payload = parseSshSkillPayload(input);
  const rawId = payload.id ?? payload.serverId;
  const idNum =
    typeof rawId === "number" && Number.isFinite(rawId)
      ? Math.trunc(rawId)
      : typeof rawId === "string" && rawId.trim() !== ""
        ? Number.parseInt(rawId.trim(), 10)
        : Number.NaN;
  const command = typeof config.command === "string" ? config.command.trim() : "";

  if (!command) {
    return JSON.stringify({ error: "No command configured for server-resource-status skill" });
  }

  if (!Number.isFinite(idNum) || idNum < 1) {
    return JSON.stringify({
      error: "Missing id. Use server_lookup with serverName, then pass the chosen server ledger id.",
    });
  }

  if (!userId?.trim()) {
    return JSON.stringify({ error: "X-User-Id is required to run server-resource-status skill." });
  }

  const headers: Record<string, string> = {
    "X-Agent-Token": apiToken,
    "Content-Type": "application/json",
    "X-User-Id": userId,
    ...optionalSkillIdHeader(skillId),
  };

  const response = await axios.post(
    `${gatewayUrl}/api/skills/linux-script`,
    { id: idNum, command },
    { headers }
  );
  if (typeof response.data === "string") {
    return response.data;
  }
  if (response.data && typeof (response.data as { result?: unknown }).result === "string") {
    return (response.data as { result: string }).result;
  }
  return JSON.stringify(response.data);
}

/** Scalar fields from merged payload that may map to query or JSON body (excludes reserved keys). */
function collectMergedScalarFields(merged: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (["query", "headers", "body"].includes(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value;
    }
  }
  return out;
}

/** True when contract fields may be sent in the request body (json or form) instead of URL query. */
function isMethodAllowingJsonBodyBinding(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD";
}

function mergeJsonBodyForProxy(
  merged: Record<string, unknown>,
  flatScalars: Record<string, unknown>,
): Record<string, unknown> {
  let bodyObj: Record<string, unknown> = { ...flatScalars };
  const raw = merged.body;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    bodyObj = { ...bodyObj, ...(raw as Record<string, unknown>) };
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bodyObj = { ...bodyObj, ...(parsed as Record<string, unknown>) };
      }
    } catch {
      // keep flatScalars only
    }
  }
  return bodyObj;
}

function isFormUrlEncodableScalar(v: unknown): v is string | number | boolean {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function formUrlEncodeFlatBodyObject(bodyObj: Record<string, unknown>):
  | { ok: true; body: string }
  | { ok: false; error: string } {
  for (const [key, v] of Object.entries(bodyObj)) {
    if (!isFormUrlEncodableScalar(v) && !Array.isArray(v)) {
      return {
        ok: false,
        error:
          "Parameter value not allowed for formBody binding: only flat string, number, boolean, or array values are supported. "
            + (key ? `Key '${key}' has an unsupported value type or nested shape.` : ""),
      };
    }
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(bodyObj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item !== null && item !== undefined) {
          params.append(k, String(item));
        }
      }
    } else {
      params.set(k, String(v));
    }
  }
  return { ok: true, body: params.toString() };
}

type ApiProxyOutboundBodyMode = "none" | "json" | "form";

function mergeHeadersForApiProxy(
  configHeaders: Record<string, string> | undefined,
  method: string,
  outboundBody: ApiProxyOutboundBodyMode,
): Record<string, string> {
  const out: Record<string, string> = { ...(configHeaders || {}) };
  if (outboundBody === "none") return out;
  const m = method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(m)) return out;
  if (outboundBody === "json") {
    out["Content-Type"] = "application/json";
  } else {
    out["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";
  }
  return out;
}

function validateTimeoutSeconds(raw: number | undefined): number {
  const DEFAULT_TIMEOUT = 30;
  const MAX_TIMEOUT = 3600;
  if (raw === undefined || raw === null) return DEFAULT_TIMEOUT;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_TIMEOUT;
  if (raw < 1) {
    console.warn(`[api-skill] timeoutSeconds ${raw} clamped to 1`);
    return 1;
  }
  if (raw > MAX_TIMEOUT) {
    console.warn(`[api-skill] timeoutSeconds ${raw} exceeds max ${MAX_TIMEOUT}, clamped`);
    return MAX_TIMEOUT;
  }
  return Math.floor(raw);
}

function coerceMergedTypes(
  merged: Record<string, unknown>,
  properties: Record<string, { type?: string; items?: { type?: string } }>,
): void {
  for (const [key, prop] of Object.entries(properties)) {
    const val = merged[key];
    if (val === undefined || val === null) continue;

    if (typeof val === "string" && prop.type === "number") {
      const n = Number(val);
      if (Number.isFinite(n)) {
        merged[key] = n;
      }
    } else if (typeof val === "string" && prop.type === "boolean") {
      const lower = val.trim().toLowerCase();
      if (lower === "true" || lower === "1" || lower === "yes") {
        merged[key] = true;
      } else if (lower === "false" || lower === "0" || lower === "no" || lower === "") {
        merged[key] = false;
      }
    } else if (typeof val === "string" && prop.type === "array") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            merged[key] = parsed;
          }
        } catch {
          // not valid JSON array, leave as-is
        }
      }
    } else if (typeof val === "string" && prop.type === "integer") {
      const n = parseInt(val, 10);
      if (Number.isFinite(n)) {
        merged[key] = n;
      }
    }
  }
}

async function executeConfiguredApiSkill(
  gatewayUrl: string,
  apiToken: string,
  userId: string | undefined,
  input: unknown,
  config: ExtendedSkillConfig,
  skillId?: number,
  sessionId?: string,
): Promise<string> {
  const method = (config.method || "GET").toUpperCase();
  let payload: Record<string, unknown>;
  if (typeof input === "string") {
    payload = parseToolInput(input);
  } else if (input && typeof input === "object" && !Array.isArray(input)) {
    payload = { ...(input as Record<string, unknown>) };
  } else {
    payload = {};
  }
  payload = normalizeApiSkillPayload(payload);
  const defaults = collectParameterDefaults(config.parameterContract);
  const merged: Record<string, unknown> = { ...defaults, ...payload };

  if (config.parameterContract && config.parameterContract.properties) {
    coerceMergedTypes(merged, config.parameterContract.properties);
  }

  // Validate merged payload against parameterContract if defined (JSON Schema shape)
  if (config.parameterContract && config.parameterContract.type === "object" && config.parameterContract.properties) {
    const normalizedContract = normalizeParameterContractForValidation(config.parameterContract);
    const validate = ajv.compile(normalizedContract);
    const valid = validate(merged);

    if (!valid) {
      const errors = validate.errors?.map(err => {
        const path = err.instancePath ? `'${err.instancePath.substring(1)}' ` : '';
        return `${path}${err.message}`;
      }) || ["Unknown validation error"];

      return JSON.stringify({
        error: "Parameter validation failed",
        details: errors,
        expectedContract: config.parameterContract,
        ...(config.interfaceDescription?.trim()
          ? { interfaceDescription: config.interfaceDescription.trim() }
          : {}),
        hint: "Do not use empty strings as placeholders for required fields. Omit keys or use valid values per the contract, then call this tool again. "
          + "Defaults from the skill parameter contract are applied when a key is omitted.",
      });
    }
  }

  const binding = normalizeParameterBindingValue(config.parameterBinding) ?? "query";
  const flatScalars = collectMergedScalarFields(merged);
  const canBindScalarsToRequestBody = isMethodAllowingJsonBodyBinding(method);
  const useJsonBody = binding === "jsonBody" && canBindScalarsToRequestBody;
  const useFormBody = binding === "formBody" && canBindScalarsToRequestBody;

  const query = {
    ...toQueryRecord(config.query),
    ...toQueryRecord(merged.query),
  };

  if (!useJsonBody && !useFormBody) {
    for (const [key, value] of Object.entries(merged)) {
      if (["query", "headers", "body"].includes(key)) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        query[key] = value;
      }
    }
  }

  const endpoint = config.endpoint ? buildUrlWithQuery(config.endpoint, query) : "";
  if (!endpoint) {
    return JSON.stringify({ error: "No endpoint configured for API skill" });
  }

  let outboundBody: ApiProxyOutboundBodyMode = "none";
  let requestBody: unknown = merged.body ?? "";
  if (useFormBody) {
    const mergedForBody = mergeJsonBodyForProxy(merged, flatScalars);
    const enc = formUrlEncodeFlatBodyObject(mergedForBody);
    if (enc.ok === false) {
      return JSON.stringify({
        error: "Form body parameter merge failed",
        details: [enc.error],
        hint: "With parameterBinding formBody, only flat string, number, boolean, or array values are allowed; nested objects are not supported. "
          + "Adjust the parameter contract and arguments, then try again.",
      });
    }
    requestBody = enc.body;
    outboundBody = "form";
  } else if (useJsonBody) {
    requestBody = mergeJsonBodyForProxy(merged, flatScalars);
    outboundBody = "json";
  }

  const headersOut = mergeHeadersForApiProxy(config.headers, method, outboundBody);
  const timeoutSeconds = validateTimeoutSeconds(config.timeoutSeconds);

  if (config.asyncPoll) {
    // 异步配置规范化：用户只勾「启用异步轮询」但没配 pollEndpoint 时，
    // 自动 fallback 到 SINGLE_CALL 模式（提交后立即返回，长 readTimeout 等结果）。
    // 这样长程 GET / POST 接口不用配轮询端点也能异步返回大模型。
    const effectiveAsyncPoll: AsyncPollConfig = { ...config.asyncPoll };
    if (!effectiveAsyncPoll.pollEndpoint && effectiveAsyncPoll.pollStrategy !== "PERIODIC") {
      effectiveAsyncPoll.pollStrategy = "SINGLE_CALL";
    }
    if (effectiveAsyncPoll.pollStrategy === "SINGLE_CALL") {
      // SINGLE_CALL：readTimeout 默认 600s（10 分钟）。
      // 不复用 maxWaitSeconds —— 后者是 PERIODIC 轮询的最长等待时间，语义不同。
      // 太小（如 10s）会导致长程任务在到达前就被服务端断开。
      if (!effectiveAsyncPoll.singleCallReadTimeoutSeconds || effectiveAsyncPoll.singleCallReadTimeoutSeconds < 60) {
        effectiveAsyncPoll.singleCallReadTimeoutSeconds = 600;
      }
    }
    return await executeConfiguredApiSkillAsync(
      gatewayUrl, apiToken, userId, endpoint, method, headersOut, requestBody,
      timeoutSeconds, effectiveAsyncPoll, skillId, sessionId
    );
  }

  try {
    const response = await axios.post(
      `${gatewayUrl}/api/skills/api`,
      {
        url: endpoint,
        method,
        headers: headersOut,
        body: requestBody,
        timeoutSeconds,
      },
      {
        headers: gatewayApiProxyInboundHeaders(apiToken, userId, skillId, sessionId),
        timeout: (timeoutSeconds + 5) * 1000,
      }
    );

    return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      if (isTimeout) {
        return JSON.stringify({
          error: "API Skill HTTP request timed out",
          timeoutSeconds,
          hint:
            `The request exceeded the configured timeout of ${timeoutSeconds} seconds. `
            + "You may ask the user if they want to increase timeoutSeconds or configure asyncPoll for long-running tasks.",
        });
      }
      const details =
        typeof data === "string"
          ? data
          : data !== undefined && data !== null
            ? JSON.stringify(data)
            : error.message;
      return JSON.stringify({
        error: "Gateway API proxy request failed",
        status: status ?? null,
        details,
        hint:
          "The Skill Gateway could not complete the HTTP call (network, timeout, or upstream error). "
          + "Fix connectivity or URL and retry this skill invocation.",
      });
    }
    throw error;
  }
}

async function executeConfiguredApiSkillAsync(
  gatewayUrl: string,
  apiToken: string,
  userId: string | undefined,
  endpoint: string,
  method: string,
  headersOut: Record<string, string>,
  requestBody: unknown,
  timeoutSeconds: number,
  asyncPoll: AsyncPollConfig,
  skillId?: number,
  sessionId?: string,
): Promise<string> {
  const auditHeaders = gatewayApiProxyInboundHeaders(apiToken, userId, skillId, sessionId);

  try {
    console.log(`[executeConfiguredApiSkillAsync] submit user=${userId} session=${sessionId} method=${method} url=${endpoint} bodyType=${typeof requestBody} bodyPreview=${JSON.stringify(requestBody).substring(0, 200)} sig-pre=(${method}|${endpoint}|${JSON.stringify(requestBody).substring(0, 80)})`);
    const submitResponse = await axios.post(
      `${gatewayUrl}/api/skills/api/async`,
      {
        url: endpoint,
        method,
        headers: headersOut,
        body: requestBody,
        timeoutSeconds,
        asyncPoll,
      },
      {
        headers: auditHeaders,
        timeout: (timeoutSeconds + 5) * 1000,
      }
    );

    const { asyncTaskId, externalTaskId } = submitResponse.data as {
      asyncTaskId: number;
      status: string;
      externalTaskId: string;
    };

    if (!asyncTaskId) {
      return JSON.stringify({
        error: "Async task submission failed",
        details: submitResponse.data,
      });
    }

    // SINGLE_CALL 模式：提交后立即返回，不阻塞 LLM。
    // 后台由 Scheduler 跑长调用，结果进通知中心。
    if (asyncPoll.pollStrategy === "SINGLE_CALL") {
      postPollingAudit(gatewayUrl, auditHeaders, {
        asyncTaskId,
        skillId,
        userId,
        sessionId,
        phase: "AGENT_REQUEST",
        extraJson: JSON.stringify({
          pollStrategy: "SINGLE_CALL",
          singleCallReadTimeoutSeconds: asyncPoll.singleCallReadTimeoutSeconds
            || asyncPoll.maxWaitSeconds || 600,
        }),
      });
      return JSON.stringify({
        asyncTaskId,
        externalTaskId,
        status: "SINGLE_CALLED",
        note:
          `Long-running one-shot call submitted (id=${asyncTaskId}). `
          + "The result will be available in the notification center when the upstream returns. "
          + "Tell the user the operation is being processed in the background.",
      });
    }

    // PERIODIC 模式（带 pollEndpoint 的轮询式异步）：
    // 与 SINGLE_CALL 一样，提交后立即返回，不阻塞 LLM。
    // gateway 已经在 submit 阶段同步调过一次第三方拿到 externalTaskId，
    // 后续轮询由 gateway Scheduler 后台跑，结果进通知中心。
    // maxWaitMs 只作为 gateway Scheduler 兜底超时用，agent-core 不再等待。
    const maxWaitMs = asyncPoll.maxWaitSeconds
      ? asyncPoll.maxWaitSeconds * 1000
      : (asyncPoll.maxWaitMs || 600000);

    postPollingAudit(gatewayUrl, auditHeaders, {
      asyncTaskId,
      skillId,
      userId,
      sessionId,
      phase: "AGENT_REQUEST",
      extraJson: JSON.stringify({
        pollStrategy: "PERIODIC",
        pollMethod: asyncPoll.pollMethod || "GET",
        pollIntervalSeconds: asyncPoll.pollIntervalSeconds || 5,
        maxWaitMs,
        fireAndForget: true,
      }),
    });

    return JSON.stringify({
      asyncTaskId,
      externalTaskId,
      status: "POLLING",
      note:
        `Polling-based async task submitted (id=${asyncTaskId}, external=${externalTaskId || "n/a"}). `
        + "The result will be available in the notification center when polling completes. "
        + "Tell the user the operation is being processed in the background.",
    });
  } catch (error) {
    const auditLog: {
      skillId?: number;
      userId?: string;
      sessionId?: string;
      phase: string;
      responseBody?: string;
      status?: string;
      errorMessage?: string;
      errorStack?: string;
      extraJson?: string;
    } = {
      skillId,
      userId,
      sessionId,
      phase: "AGENT_ERROR",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    if (axios.isAxiosError(error)) {
      if (error.response?.status) {
        auditLog.status = String(error.response.status);
      }
      if (error.response?.data) {
        auditLog.responseBody = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      }
      auditLog.extraJson = JSON.stringify({
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
      });
    }

    postPollingAudit(gatewayUrl, gatewayApiProxyInboundHeaders(apiToken, userId, skillId, sessionId), auditLog);

    if (axios.isAxiosError(error)) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      if (isTimeout) {
        return JSON.stringify({
          error: "Async task submission or wait timed out",
          hint: "The async task may still be running. You can retry or check with the user if the task is expected to take longer.",
        });
      }
      return JSON.stringify({
        error: "Async API request failed",
        details: error.response?.data ?? error.message,
      });
    }
    throw error;
  }
}

function postPollingAudit(
  gatewayUrl: string,
  headers: Record<string, string>,
  log: {
    asyncTaskId?: number;
    skillId?: number;
    userId?: string;
    sessionId?: string;
    phase: string;
    responseBody?: string;
    status?: string;
    errorMessage?: string;
    errorStack?: string;
    extraJson?: string;
  },
): void {
  axios.post(
    `${gatewayUrl}/api/internal/polling-audit/events`,
    [{
      asyncTaskId: log.asyncTaskId,
      skillId: log.skillId,
      userId: log.userId,
      sessionId: log.sessionId,
      phase: log.phase,
      recordedAt: new Date().toISOString(),
      responseBody: log.responseBody,
      status: log.status,
      errorMessage: log.errorMessage,
      errorStack: log.errorStack,
      extraJson: log.extraJson,
    }],
    {
      headers,
      timeout: 5000,
    },
  ).catch(() => {
    // audit failure never blocks business
  });
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
export type BindableAgentTool = Tool | DynamicTool | StructuredTool;

async function invokeToolDirect(tool: BindableAgentTool, input: unknown): Promise<string> {
  const callableTool = tool as any;
  let rawResult: unknown;
  if (isStructuredTool(tool)) {
    const parsed =
      typeof input === "string"
        ? (JSON.parse((input as string).trim() || "{}") as Record<string, unknown>)
        : input !== undefined && input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
    rawResult = await tool.invoke(parsed);
  } else {
    const serializedInput = typeof input === "string" ? input : JSON.stringify(input ?? {});
    rawResult = callableTool.func
      ? await callableTool.func(serializedInput)
      : await callableTool.invoke(serializedInput);
  }

  if (typeof rawResult === "string") return rawResult;
  if (rawResult && typeof rawResult === "object") {
    const c = (rawResult as Record<string, unknown>).content;
    if (typeof c === "string") return c;
  }

  return JSON.stringify(rawResult ?? "");
}

function summarizeToolResult(result: string): string | undefined {
  const trimmed = result.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (typeof (parsed as Record<string, unknown>).error === "string") {
        return String((parsed as Record<string, unknown>).error);
      }
      if (typeof (parsed as Record<string, unknown>).result === "string") {
        return String((parsed as Record<string, unknown>).result);
      }
      if (typeof (parsed as Record<string, unknown>).readableTime === "string") {
        return String((parsed as Record<string, unknown>).readableTime);
      }
    }
  } catch {
    // Ignore non-JSON outputs.
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function resolveAllowedTools(
  allowedTools: string[] | undefined,
  toolLookup: Map<string, BindableAgentTool>,
): BindableAgentTool[] {
  const names = Array.isArray(allowedTools) ? allowedTools : [];
  const resolved = names
    .map((name) => toolLookup.get(name) ?? toolLookup.get(name.trim()) ?? toolLookup.get(name.replace(/-/g, "_")))
    .filter(Boolean) as BindableAgentTool[];

  const deduped = new Map<string, BindableAgentTool>();
  resolved.forEach((tool) => deduped.set(tool.name, tool));
  return Array.from(deduped.values());
}

async function executeOpenClawSkill(
  plannerModel: any,
  parentToolName: string,
  input: string,
  config: ExtendedSkillConfig,
  availableTools: BindableAgentTool[],
): Promise<string> {
  const orchestrationMode = config.orchestration?.mode || "serial";
  if (orchestrationMode !== "serial") {
    return JSON.stringify({ error: `Unsupported OPENCLAW orchestration mode: ${orchestrationMode}` });
  }

  const availableToolLookup = new Map<string, BindableAgentTool>();
  availableTools.forEach((tool) => {
    availableToolLookup.set(tool.name, tool);
    availableToolLookup.set(tool.name.replace(/_/g, "-"), tool);
    availableToolLookup.set(tool.name.replace(/-/g, "_"), tool);
    const metadata = describeGatewayExtendedTool(tool.name);
    if (metadata?.displayName) {
      availableToolLookup.set(metadata.displayName, tool);
    }
  });

  const allowedTools = resolveAllowedTools(config.allowedTools, availableToolLookup);
  const missingTools = (config.allowedTools || []).filter((name) => (
    !availableToolLookup.get(name)
    && !availableToolLookup.get(name.trim())
    && !availableToolLookup.get(name.replace(/-/g, "_"))
  ));
  if (missingTools.length > 0) {
    return JSON.stringify({ error: `OPENCLAW skill is missing required tools: ${missingTools.join(", ")}` });
  }

  const parentToolId = getActiveParentToolId(parentToolName);
  const planner = allowedTools.length > 0
    ? (plannerModel && typeof plannerModel.bindTools === "function" ? plannerModel.bindTools(allowedTools) : null)
    : plannerModel;
  if (!planner || typeof planner.invoke !== "function") {
    return JSON.stringify({ error: "OPENCLAW planner model is unavailable." });
  }
  const systemPrompt = [
    config.systemPrompt || "You are an autonomous planning skill.",
    "You MUST call exactly ONE tool per turn, in order. Never emit multiple tool_calls in a single response.",
    "Do not skip required tool calls.",
    "For the compute tool, use structured arguments: operation (enum) and operands (array)—see tool schema. Do not nest under an input key.",
    "If the user's input is ambiguous or cannot be reliably parsed, ask a clarification question instead of guessing.",
  ].join("\n\n");

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: input || "{}" },
  ];

  for (let round = 0; round < 6; round += 1) {
    const response = await planner.invoke(messages);
    const rawToolCalls = Array.isArray((response as any)?.tool_calls) ? (response as any).tool_calls : [];

    let toolCalls = rawToolCalls;
    if (orchestrationMode === "serial" && rawToolCalls.length > 1) {
      toolCalls = [rawToolCalls[0]];
      messages.push(
        new AIMessage({
          content: (response as AIMessage).content ?? "",
          tool_calls: toolCalls as any,
        }),
      );
    } else {
      messages.push(response);
    }

    if (toolCalls.length === 0) {
      const content = (response as any)?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((part: any) => typeof part === "string" ? part : part?.text || "")
          .join("");
      }
      return JSON.stringify(content ?? "");
    }

    for (const toolCall of toolCalls) {
      const tool = allowedTools.find((candidate) => candidate.name === toolCall.name);
      if (!tool) {
        return JSON.stringify({ error: `OPENCLAW skill tried to call unauthorized tool: ${toolCall.name}` });
      }

      const childToolId = typeof toolCall.id === "string" && toolCall.id.trim()
        ? toolCall.id
        : `${parentToolName}:${tool.name}:${round}`;
      const childDisplayName = describeGatewayExtendedTool(tool.name)?.displayName || tool.name;
      emitToolTraceEvent({
        type: "tool_status",
        toolId: childToolId,
        toolName: tool.name,
        displayName: childDisplayName,
        kind: describeGatewayExtendedTool(tool.name)?.kind || "tool",
        status: "running",
        parentToolId,
        parentToolName,
        arguments: sanitizeToolTraceArguments(toolCall.args || {}),
      });

      try {
        const result = await invokeToolDirect(tool, toolCall.args || {});
        emitToolTraceEvent({
          type: "tool_status",
          toolId: childToolId,
          toolName: tool.name,
          displayName: childDisplayName,
          kind: describeGatewayExtendedTool(tool.name)?.kind || "tool",
          status: "completed",
          parentToolId,
          parentToolName,
          summary: summarizeToolResult(result),
          result: sanitizeToolResultForTrace(result),
        });
        const resolvedCallId =
          typeof toolCall.id === "string" && toolCall.id.trim() ? toolCall.id : childToolId;
        messages.push({
          role: "tool",
          tool_call_id: resolvedCallId,
          content: result,
        });
      } catch (error) {
        if (isGraphInterrupt(error)) throw error;
        const message = formatToolError(error);
        emitToolTraceEvent({
          type: "tool_status",
          toolId: childToolId,
          toolName: tool.name,
          displayName: childDisplayName,
          kind: describeGatewayExtendedTool(tool.name)?.kind || "tool",
          status: "failed",
          parentToolId,
          parentToolName,
          summary: message,
          result: sanitizeToolResultForTrace(message),
        });
        const resolvedCallId =
          typeof toolCall.id === "string" && toolCall.id.trim() ? toolCall.id : childToolId;
        messages.push({
          role: "tool",
          tool_call_id: resolvedCallId,
          content: JSON.stringify({ error: message }),
        });
      }
    }
  }

  return JSON.stringify({ error: "OPENCLAW skill exceeded the maximum planning steps." });
}

export function gatewaySkillMutationHeaders(apiToken: string, userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Agent-Token": apiToken,
    "Content-Type": "application/json",
  };
  if (userId && String(userId).trim()) {
    headers["X-User-Id"] = String(userId).trim();
  }
  return headers;
}

export function gatewaySkillReadHeaders(apiToken: string, userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Agent-Token": apiToken,
  };
  if (userId && String(userId).trim()) {
    headers["X-User-Id"] = String(userId).trim();
  }
  return headers;
}

/**
 * When set, Skill Gateway MDC records `X-Skill-Id` for outbound audit (`gateway_outbound_audit_logs.skill_id`).
 * Omitted for built-in tools that are not bound to a persisted extension skill row.
 */
function optionalSkillIdHeader(skillId?: number): Record<string, string> {
  if (skillId !== undefined && Number.isFinite(skillId) && skillId > 0) {
    return { "X-Skill-Id": String(Math.trunc(skillId)) };
  }
  return {};
}

/** Inbound headers for `POST /api/skills/api` (proxy); includes `X-User-Id` when set so Gateway audit MDC sees the end user. */
function gatewayApiProxyInboundHeaders(
  apiToken: string,
  userId?: string,
  skillId?: number,
  sessionId?: string,
): Record<string, string> {
  return {
    ...gatewaySkillReadHeaders(apiToken, userId),
    "Content-Type": "application/json",
    ...optionalSkillIdHeader(skillId),
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
  };
}

/** Raw tool args shown in the confirmation UI. */
function previewExtendedSkillToolInput(rawInput: unknown): unknown {
  if (rawInput === undefined || rawInput === null) return {};
  if (typeof rawInput === "object" && !Array.isArray(rawInput)) return rawInput;
  if (typeof rawInput === "string") {
    const t = rawInput.trim();
    if (!t) return {};
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return rawInput;
    }
  }
  return rawInput;
}

/** Legacy string envelope for tests / invoke paths that still pass JSON strings. */
function parseExtendedSkillConfirmationInput(input: string): {
  confirmed: boolean;
  executionInput: string;
} {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { confirmed: false, executionInput: "" };
  }
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (obj && typeof obj === "object" && !Array.isArray(obj) && "confirmed" in obj) {
      const confirmed = Boolean(obj.confirmed);
      const rest = { ...obj };
      delete (rest as { confirmed?: unknown }).confirmed;
      const executionInput = Object.keys(rest).length > 0 ? JSON.stringify(rest) : "";
      return { confirmed, executionInput };
    }
  } catch {
    // not JSON
  }
  return { confirmed: false, executionInput: trimmed };
}

/**
 * When confirmation is required: if args already include `confirmed`, strip it; else interrupt.
 * After LangGraph resume with user approval, execution continues in the **same** invocation with the
 * same execInput (no `confirmed` field) — same behavior as the legacy string tool path.
 */
function applyExtendedSkillConfirmationGate(
  execInput: unknown,
  needsConfirmation: boolean,
  runConfig: RunnableConfig | undefined,
  toolName: string,
  currentSkill: GatewaySkill,
): { proceed: true; payload: unknown } | { proceed: false; cancelled: boolean } {
  if (!needsConfirmation) {
    return { proceed: true, payload: execInput };
  }

  const o = execInput && typeof execInput === "object" && !Array.isArray(execInput)
    ? (execInput as Record<string, unknown>)
    : null;
  if (o && "confirmed" in o) {
    if (!Boolean(o.confirmed)) {
      return { proceed: false, cancelled: true };
    }
    const rest = { ...o };
    delete (rest as { confirmed?: unknown }).confirmed;
    return { proceed: true, payload: rest };
  }

  const tc = (runConfig as { toolCall?: { id?: string } } | undefined)?.toolCall;
  const toolCallId =
    (typeof tc?.id === "string" && tc.id.trim())
      ? tc.id.trim()
      : `${toolName}:pending`;
  const resume = interrupt<
    {
      kind: "extended_skill_confirmation";
      toolName: string;
      toolCallId: string;
      skillName: string;
      skillId: number;
      summary: string;
      details: string;
      parametersPreview: unknown;
    },
    { confirmed: boolean }
  >({
    kind: "extended_skill_confirmation",
    toolName,
    toolCallId,
    skillName: currentSkill.name || toolName,
    skillId: currentSkill.id,
    summary: `Execute extended skill: ${currentSkill.name || toolName}`,
    details: "",
    parametersPreview: previewExtendedSkillToolInput(execInput),
  });
  const result = resume as { confirmed: boolean; adjustedParams?: Record<string, unknown> };
  if (!result.confirmed) {
    return { proceed: false, cancelled: true };
  }
  const finalInput = result.adjustedParams
    ? { ...(execInput as Record<string, unknown>), ...result.adjustedParams }
    : execInput;
  if (result.adjustedParams && Object.keys(result.adjustedParams).length > 0) {
    console.log(`[skill-confirm] tool=${toolName} adjustedParams keys=${JSON.stringify(Object.keys(result.adjustedParams))} sample=${JSON.stringify(result.adjustedParams).slice(0, 200)}`);
  }
  return { proceed: true, payload: finalInput };
}

async function saveGeneratedSkill(
  gatewayUrl: string,
  apiToken: string,
  payload: SkillMutationPayload,
  allowOverwrite: boolean,
  userId?: string
): Promise<{ mode: "created" | "updated"; skill: GatewaySkill } | { error: string; status: "conflict" | "save_failed" }> {
  const headers = gatewaySkillMutationHeaders(apiToken, userId);
  const readHeaders = gatewaySkillReadHeaders(apiToken, userId);

  try {
    const existingSkillsResponse = await axios.get(`${gatewayUrl}/api/skills`, { headers: readHeaders });
    const existingSkills = Array.isArray(existingSkillsResponse.data) ? existingSkillsResponse.data as GatewaySkill[] : [];
    const existingSkill = existingSkills.find((entry) => entry.name === payload.name);

    if (!existingSkill) {
      const created = await axios.post(`${gatewayUrl}/api/skills`, payload, { headers });
      return {
        mode: "created",
        skill: created.data as GatewaySkill,
      };
    }

    if (!allowOverwrite) {
      return {
        status: "conflict",
        error: `Skill "${payload.name}" already exists. Re-run with "allowOverwrite": true to update it.`,
      };
    }

    const owner = (existingSkill.createdBy || "").trim();
    const uid = userId ? String(userId).trim() : "";
    if (owner && uid && owner !== uid) {
      const platformAuthor = "public";
      const platformAdmin = "890728";
      const adminCanTakePlatform = owner === platformAuthor && uid === platformAdmin;
      if (!adminCanTakePlatform) {
        return {
          status: "conflict",
          error: `Skill "${payload.name}" is owned by another user and cannot be overwritten.`,
        };
      }
    }

    const updated = await axios.put(`${gatewayUrl}/api/skills/${existingSkill.id}`, payload, { headers });
    return {
      mode: "updated",
      skill: updated.data as GatewaySkill,
    };
  } catch (error) {
    return {
      status: "save_failed",
      error: formatToolError(error),
    };
  }
}

export async function loadGatewayExtendedTools(
  gatewayUrl: string,
  apiToken: string,
  userId?: string,
  options?: {
    plannerModel?: any;
    /** Base agent tools (including structured tools such as compute). */
    availableTools?: BindableAgentTool[];
    /** Session id passed to gateway execute endpoint (used for audit/confirmation/async task) */
    sessionId?: string;
  },
): Promise<StructuredTool[]> {
  try {
    const listHeaders = gatewaySkillReadHeaders(apiToken, userId);
    const response = await axios.get(`${gatewayUrl}/api/skills`, {
      headers: listHeaders,
    });

    const skills = Array.isArray(response.data) ? response.data as GatewaySkill[] : [];
    const extensionSkills = skills.filter(
      (skill) => skill.enabled && (skill.type || "").toUpperCase() === "EXTENSION"
    );
    const toolLookup = new Map<string, BindableAgentTool>();
    (options?.availableTools || []).forEach((tool) => {
      toolLookup.set(tool.name, tool);
    });

    const resolvedTools: StructuredTool[] = [];
    for (const skill of extensionSkills) {
      console.log(`[DEBUG] skill ${skill.id} configuration:`, skill.configuration);
      let workingSkill = skill;
      let config = skill.configuration ? parseSkillConfig(skill) : {} as ExtendedSkillConfig;
      if (!skill.configuration?.trim()) {
        try {
          const detailResponse = await axios.get(`${gatewayUrl}/api/skills/${skill.id}`, {
            headers: gatewaySkillReadHeaders(apiToken, userId),
          });
          workingSkill = detailResponse.data as GatewaySkill;
          config = parseSkillConfig(workingSkill);
        } catch {
          /* keep empty config; tool may still error at runtime */
        }
      }
      const toolName = normalizeToolName(skill.name || `skill_${skill.id}`, skill.id);
      registerGatewayToolMetadata(toolName, workingSkill);

      let toolDescription = workingSkill.description || `Execute extended skill: ${workingSkill.name}`;
      toolDescription = appendParameterContractToToolDescription(toolDescription, config);
      if (workingSkill.requiresConfirmation) {
        toolDescription +=
          " If this skill requires confirmation, approval happens via the chat UI buttons only; do not instruct the user to type \"confirm\" or to send JSON with confirmed:true.";
      }

      const zodSchema = buildExtendedSkillZodSchema(config);
      const structuredTool = new DynamicStructuredTool({
        name: toolName,
        description: toolDescription,
        schema: zodSchema,
        func: async (args: Record<string, unknown>, _runManager?: unknown, runConfig?: RunnableConfig) => {
          try {
            // 兼容 DeepSeek 严格 schema 校验：模型可能把参数包在 `payload` 字段下。
            // 如果 args 看起来是包装形式（只有一个 payload 字段），解包后使用。
            let normalizedArgs: Record<string, unknown> = args || {};
            if (
              normalizedArgs
              && typeof normalizedArgs === "object"
              && Object.keys(normalizedArgs).length === 1
              && "payload" in normalizedArgs
            ) {
              normalizedArgs = (normalizedArgs.payload as Record<string, unknown>) || {};
            }
            let execInput: unknown = normalizedArgs;
            let currentSkill = workingSkill;
            let currentConfig = config;

            // Always fetch latest config from Gateway so edits (timeoutSeconds, parameterBinding,
            // asyncPoll, etc.) take effect immediately without restarting Agent Core.
            try {
              const detailResponse = await axios.get(`${gatewayUrl}/api/skills/${skill.id}`, {
                headers: gatewaySkillReadHeaders(apiToken, userId),
              });
              currentSkill = detailResponse.data as GatewaySkill;
              currentConfig = parseSkillConfig(currentSkill);
            } catch {
              // Gateway unavailable; fall back to cached config
            }

            const executionMode = normalizeExecutionMode(currentSkill.executionMode);
            const needsConfirmation = Boolean(currentSkill.requiresConfirmation);
            const gate = applyExtendedSkillConfirmationGate(
              execInput,
              needsConfirmation,
              runConfig,
              toolName,
              currentSkill,
            );
            if (!gate.proceed) {
              return JSON.stringify({
                status: "CANCELLED",
                message: "User cancelled the skill execution.",
              });
            }
            execInput = gate.payload;

            if (isCurrentTimeSkillConfig(currentConfig)) {
              return await executeCurrentTimeSkill(gatewayUrl, apiToken, userId, currentConfig, currentSkill.id);
            }
            if (isServerMonitorSkillConfig(currentConfig)) {
              return await executeServerResourceStatusSkill(
                gatewayUrl,
                apiToken,
                userId,
                execInput,
                currentConfig,
                currentSkill.id,
              );
            }
            if (executionMode === "OPENCLAW" || currentConfig.kind === "openclaw") {
              const openClawInput =
                typeof execInput === "string"
                  ? execInput
                  : execInput && typeof execInput === "object" && typeof (execInput as Record<string, unknown>).input === "string"
                    ? String((execInput as Record<string, unknown>).input)
                    : JSON.stringify(execInput ?? {});
              return await executeOpenClawSkill(
                options?.plannerModel,
                toolName,
                openClawInput,
                currentConfig,
                Array.from(toolLookup.values()),
              );
            }
            if ((currentConfig.kind || "").toLowerCase() === "template") {
              const basePrompt = (currentConfig.prompt || "").trim();
              const userPayload =
                typeof execInput === "string"
                  ? execInput.trim()
                  : execInput && typeof execInput === "object" && typeof (execInput as Record<string, unknown>).input === "string"
                    ? String((execInput as Record<string, unknown>).input)
                    : "";
              return JSON.stringify({
                kind: "template",
                prompt: basePrompt,
                userInput: userPayload,
                instruction:
                  "The user's parameters are in userInput. Combine prompt with userInput and write the complete result "
                  + "in your next assistant message as natural language. Do NOT call this tool again for the same request.",
              });
            }
            if ((currentConfig.kind || "").toLowerCase() === "api" || currentConfig.operation === "api-request" || currentConfig.operation === "juhe-joke-list") {
              const sessionId = runConfig?.configurable?.thread_id as string | undefined;
              return await executeConfiguredApiSkill(gatewayUrl, apiToken, userId, execInput, currentConfig, currentSkill.id, sessionId);
            }
            if ((currentConfig.kind || "").toLowerCase() === "ssh") {
              return JSON.stringify({
                error: `Unsupported ssh preset for skill: ${readPreset(currentConfig) || "unknown"}`,
              });
            }
            return JSON.stringify({
              error: `Unsupported extended skill operation: ${currentConfig.operation || "unknown"}`,
              skill: currentSkill.name,
            });
          } catch (error) {
            if (isGraphInterrupt(error)) throw error;
            return `Error executing extended skill "${skill.name}": ${formatToolError(error)}`;
          }
        },
      });
      resolvedTools.push(structuredTool);
      toolLookup.set(structuredTool.name, structuredTool);
      if (skill.name) {
        toolLookup.set(skill.name, structuredTool);
      }
    }

    return resolvedTools;
  } catch (error) {
    console.error("[agent-core] Failed to load extended skills from gateway:", formatToolError(error));
    return [];
  }
}

/**
 * Build JSON string for legacy DynamicTool input with `confirmed: true` merged with prior tool args.
 */
export function buildConfirmedToolInputString(args: unknown): string {
  return JSON.stringify(buildConfirmedToolArgs(args));
}

/** Merge prior tool args with `confirmed: true` for structured extended skills (confirmation resume). */
export function buildConfirmedToolArgs(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) {
    return { confirmed: true };
  }
  if (typeof args === "object" && !Array.isArray(args)) {
    return { ...(args as Record<string, unknown>), confirmed: true };
  }
  if (typeof args === "string") {
    const trimmed = args.trim();
    if (!trimmed) return { confirmed: true };
    try {
      const o = JSON.parse(trimmed) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) {
        return { ...(o as Record<string, unknown>), confirmed: true };
      }
    } catch {
      return { confirmed: true, input: trimmed };
    }
    return { confirmed: true, input: trimmed };
  }
  return { confirmed: true, input: String(args) };
}

/**
 * Re-run an extended skill tool with the same arguments plus `confirmed: true` (no LLM).
 */
export async function invokeExtendedSkillWithConfirmed(
  gatewayUrl: string,
  apiToken: string,
  userId: string | undefined,
  toolName: string,
  toolArguments: unknown,
  options: {
    plannerModel: any;
    availableTools: BindableAgentTool[];
  },
): Promise<string> {
  const extendedTools = await loadGatewayExtendedTools(gatewayUrl, apiToken, userId, {
    plannerModel: options.plannerModel,
    availableTools: options.availableTools,
  });
  const underscore = toolName.replace(/-/g, "_");
  const tool =
    extendedTools.find((t) => t.name === toolName)
    ?? extendedTools.find((t) => t.name === underscore);
  if (!tool) {
    return JSON.stringify({ error: `Extended skill tool not found: ${toolName}` });
  }
  const merged = buildConfirmedToolArgs(toolArguments);
  const raw = await (tool as DynamicStructuredTool).invoke(merged);
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

export class JavaSkillGeneratorTool extends DynamicStructuredTool<typeof skillGeneratorToolInputSchema> {
  constructor(
    private readonly gatewayUrl: string,
    private readonly apiToken: string,
    private readonly userId?: string
  ) {
    super({
      name: "skill_generator",
      description:
        "Creates a NEW extension skill on SkillGateway—use ONLY after you have confirmed no existing tool (built-in, gateway extensions, or loadable filesystem skills) can fulfill the request, OR the user explicitly asked to add/create a new skill. " +
        "Provide targetType and the corresponding fields for that type (api, ssh, openclaw, or template) as structured tool arguments. " +
        "For API skills, headers, query, testInput, and parameterContract may be sent either as objects or as JSON strings; booleans may be true/false strings. " +
        "Generated POST/PUT/PATCH/DELETE API skills default `parameterBinding` to jsonBody so flat contract fields map to the JSON request body; use `formBody` in configuration for `application/x-www-form-urlencoded` POST APIs, and `query` for URL-only APIs. " +
        "After save, API and SSH extension skills are invoked with structured top-level parameters (not a single input envelope string). " +
        "On success, API-type skills return status VALIDATION_SKIPPED (no automatic HTTP probe); verify by invoking the new skill.",
      schema: skillGeneratorToolInputSchema,
      func: async (args) => {
        // Cast to the legacy interface for compatibility with existing business logic
        const params = args as SkillGeneratorInput;
        const generated = buildGeneratedSkill(params);

        if (generated.missingFields.length > 0 || !generated.skillPayload || !generated.config) {
          return JSON.stringify({
            status: "INPUT_INCOMPLETE",
            missingFields: generated.missingFields,
            message: "Missing required skill fields. Provide the missing fields and try again.",
          });
        }

        const saveResult = await saveGeneratedSkill(
          this.gatewayUrl,
          this.apiToken,
          generated.skillPayload,
          params.allowOverwrite ?? false,
          this.userId
        );

        if ("error" in saveResult) {
          return JSON.stringify({
            status: saveResult.status === "conflict" ? "SKILL_ALREADY_EXISTS" : "SAVE_FAILED",
            message: saveResult.error,
            proposedSkill: {
              ...generated.skillPayload,
              configuration: JSON.stringify(sanitizeConfigForDisplay(generated.config)),
            },
          });
        }

        // Post-save API probe (executeConfiguredApiSkill → gateway proxy) is intentionally disabled:
        // it duplicated runtime behavior, failed on empty testInput vs real calls, and surfaced as tool errors.
        let validation: ReturnType<typeof buildValidationSummary> | {
          success: true;
          skipped: true;
          message: string;
        };
        if (params.targetType === "api" || !params.targetType) {
          validation = {
            success: true,
            skipped: true,
            message:
              "Automatic post-save API probe is disabled. Invoke the saved skill manually to verify connectivity and parameters.",
          };
        } else {
          const validationRaw = JSON.stringify({
            success: true,
            message: "Validation skipped for non-API skill type.",
          });
          validation = buildValidationSummary(validationRaw);
        }

        const status = "skipped" in validation && validation.skipped
          ? "VALIDATION_SKIPPED"
          : validation.success
            ? "VALIDATION_SUCCEEDED"
            : "VALIDATION_FAILED";

        return JSON.stringify({
          status,
          saveAction: saveResult.mode,
          skill: {
            id: saveResult.skill.id,
            name: saveResult.skill.name,
            description: saveResult.skill.description,
            type: saveResult.skill.type,
            enabled: saveResult.skill.enabled,
            requiresConfirmation: saveResult.skill.requiresConfirmation,
            configuration: sanitizeConfigForDisplay(generated.config),
          },
          validationInput: generated.validationInput || {},
          validation,
        });
      },
    });
  }
}

/**
 * Java SSH 工具。
 * <p>
 * 封装对 Java Skill Gateway SSH 接口的调用。
 * 允许 Agent 在远程服务器上执行 Shell 命令。
 * </p>
 */
export class JavaSshTool extends DynamicStructuredTool<typeof sshExecutorToolInputSchema> {
  constructor(
    gatewayUrl: string,
    apiToken: string,
    userId?: string,
    options?: { dispatch?: BuiltinSkillDispatch },
  ) {
    const dispatch: BuiltinSkillDispatch = options?.dispatch ?? "legacy";
    const baseUrl = gatewayUrl.replace(/\/+$/, "");
    super({
      name: "ssh_executor",
      description:
        "Executes a shell command on a remote server via SSH. " +
        "Provide host, username, command, and either privateKey or password as separate fields. " +
        "If an extension skill covers the same SSH capability, use that extension tool instead of this built-in. " +
        "Destructive commands are gated by the in-app confirmation UI; do not ask the user to type confirmation text.",
      schema: sshExecutorToolInputSchema,
      func: async (args, _runManager, runConfig?: RunnableConfig) => {
        try {
          const headers: Record<string, string> = {
            "X-Agent-Token": apiToken,
            "Content-Type": "application/json",
          };
          if (userId) {
            headers["X-User-Id"] = userId;
          }

          const dangerousPattern = /rm\s+-rf|mkfs|dd\s+if=|shutdown|reboot/;
          if (!args.confirmed && dangerousPattern.test(args.command)) {
            const tc = (runConfig as { toolCall?: { id?: string } } | undefined)?.toolCall;
            const toolCallId =
              (typeof tc?.id === "string" && tc.id.trim())
                ? tc.id.trim()
                : "ssh_executor:pending";
            const resume = interrupt<
              {
                kind: "ssh_confirmation";
                toolName: string;
                toolCallId: string;
                skillName: string;
                summary: string;
                details: string;
                parametersPreview: Record<string, unknown>;
              },
              { confirmed: boolean }
            >({
              kind: "ssh_confirmation",
              toolName: "ssh_executor",
              toolCallId,
              skillName: "SSH",
              summary: `Execute potentially dangerous SSH command on ${args.host}`,
              details: `Command: ${args.command}`,
              parametersPreview: {
                host: args.host,
                username: args.username,
                command: args.command,
                hasPrivateKey: Boolean(args.privateKey?.trim()),
                hasPassword: Boolean(args.password),
              },
            });
            if (!resume.confirmed) {
              return JSON.stringify({
                status: "CANCELLED",
                message: "User cancelled the SSH command.",
              });
            }
          }

          const url =
            dispatch === "gateway"
              ? `${baseUrl}/api/system-skills/execute`
              : `${gatewayUrl}/api/skills/ssh`;
          const body = dispatch === "gateway" ? { toolName: "ssh_executor", arguments: args } : args;
          const response = await axios.post(url, body, { headers });
          return response.data;
        } catch (error) {
          if (isGraphInterrupt(error)) throw error;
          return `Error executing SSH command: ${formatToolError(error)}`;
        }
      },
    });
  }
}

/**
 * Java 计算工具。
 * <p>
 * 封装对 Java Skill Gateway 计算接口的调用。
 * 使用 {@link DynamicStructuredTool}，使模型侧 function schema 暴露 operation / operands，而非单一 input 字符串。
 * </p>
 */
export class JavaComputeTool extends DynamicStructuredTool<typeof computeToolInputSchema> {
  constructor(gatewayUrl: string, apiToken: string, options?: { dispatch?: BuiltinSkillDispatch }) {
    const dispatch: BuiltinSkillDispatch = options?.dispatch ?? "legacy";
    const baseUrl = gatewayUrl.replace(/\/+$/, "");
    super({
      name: "compute",
      description:
        "Math and date operations via Skill Gateway. Supply operation and operands as separate fields (see parameter schema). "
        + "Gateway body is { operation, operands }—do not wrap them in an extra input string.",
      schema: computeToolInputSchema,
      func: async (args) => {
        try {
          const headers = {
            "X-Agent-Token": apiToken,
            "Content-Type": "application/json",
          };
          const payload =
            dispatch === "gateway"
              ? { toolName: "compute", arguments: { operation: args.operation, operands: args.operands } }
              : { operation: args.operation, operands: args.operands };
          const url =
            dispatch === "gateway"
              ? `${baseUrl}/api/system-skills/execute`
              : `${gatewayUrl}/api/skills/compute`;
          const response = await axios.post(url, payload, { headers });
          return JSON.stringify(response.data);
        } catch (error) {
          return `Error executing compute: ${formatToolError(error)}`;
        }
      },
    });
  }
}

/**
 * Java Linux 脚本执行工具。
 * <p>
 * 使用 DynamicStructuredTool + Zod 提供结构化入参（id, command），
 * 避免模型在字符串中嵌套 JSON。
 * </p>
 */
export class JavaLinuxScriptTool extends DynamicStructuredTool<typeof linuxScriptToolInputSchema> {
  constructor(gatewayUrl: string, apiToken: string, userId?: string) {
    super({
      name: "linux_script_executor",
      description:
        "Executes a shell command on a server using credentials stored in the user server ledger in Skill Gateway (host, user, password or key path). " +
        "Provide the ledger `id` from server_lookup and `command` (do NOT wrap in a JSON string under 'input'). " +
        "Requires a logged-in user context (X-User-Id) for the gateway.",
      schema: linuxScriptToolInputSchema,
      func: async (args) => {
        try {
          if (!userId?.trim()) {
            return JSON.stringify({ error: "linux_script_executor requires a logged-in user (X-User-Id)." });
          }
          const response = await axios.post(
            `${gatewayUrl}/api/skills/linux-script`,
            { id: args.id, command: args.command },
            {
              headers: {
                "X-Agent-Token": apiToken,
                "Content-Type": "application/json",
                "X-User-Id": userId,
              },
            }
          );
          if (typeof response.data === "string") {
            return response.data;
          }
          if (response.data && typeof response.data.result === "string") {
            return response.data.result;
          }
          return JSON.stringify(response.data);
        } catch (error) {
          return `Error executing linux script: ${formatToolError(error)}`;
        }
      },
    });
  }
}

export class JavaServerLookupTool extends DynamicStructuredTool<typeof serverLookupToolInputSchema> {
  constructor(gatewayUrl: string, apiToken: string, userId?: string) {
    super({
      name: "server_lookup",
      description:
        "Finds up to 5 server candidates (`id` + `name`) for a user-entered serverName (relevance-ordered; connection secrets stay in Gateway DB only, not returned). " +
        "If exactly one row, use its `id` for linux_script_executor next; if several, ask the user to pick an `id`. " +
        "Provide `serverName` (do NOT wrap in a single input string).",
      schema: serverLookupToolInputSchema,
      func: async (args) => {
        try {
          const headers: Record<string, string> = {
            "X-Agent-Token": apiToken,
            "Content-Type": "application/json",
          };
          if (userId) {
            headers["X-User-Id"] = userId;
          }

          const response = await axios.get(
            `${gatewayUrl}/api/skills/server-lookup`,
            {
              headers,
              params: { serverName: args.serverName },
            }
          );
          return JSON.stringify(response.data);
        } catch (error) {
          return `Error looking up server: ${formatToolError(error)}`;
        }
      },
    });
  }
}

/**
 * Java API 工具（built-in 名：`api_caller`）。
 *
 * **当前生产默认不在 `AgentFactory` 中挂载**（见 `agent.ts`），避免与「仅通过扩展 API Skill
 * 出站」的产品策略重叠。扩展 API Skill 的执行路径是 `executeConfiguredApiSkill` →
 * `POST {gateway}/api/skills/api`，与该类**无嵌套调用关系**；切勿将扩展实现误解为「内部再调
 * `api_caller`」。
 *
 * `AGENT_BUILTIN_SKILL_DISPATCH` 仅当本工具**被注册**时，影响其出站到 Gateway 的 URL
 *（`legacy`：`/api/skills/api`；`gateway`：`/api/system-skills/execute` + `toolName: api_caller`）。
 *
 * 英文说明见 `JAVA_API_TOOL_DESCRIPTION`：使用 DynamicStructuredTool + Zod 提供 url/method/headers/body。
 */
const JAVA_API_TOOL_DESCRIPTION =
  "Calls an external API via the Java gateway. " +
  "Provide url, method, headers, and body as separate fields (do NOT wrap everything in a single JSON string under 'input'). " +
  "If an extension skill covers the same HTTP capability, use that extension tool instead of this built-in.";

export class JavaApiTool extends DynamicStructuredTool<typeof apiCallerToolInputSchema> {
  constructor(gatewayUrl: string, apiToken: string, options?: { dispatch?: BuiltinSkillDispatch }) {
    const dispatch: BuiltinSkillDispatch = options?.dispatch ?? "legacy";
    const baseUrl = gatewayUrl.replace(/\/+$/, "");
    super({
      name: "api_caller",
      description: JAVA_API_TOOL_DESCRIPTION,
      schema: apiCallerToolInputSchema,
      func: async (args) => {
        try {
          const headers = {
            "X-Agent-Token": apiToken,
            "Content-Type": "application/json",
          };
          const url =
            dispatch === "gateway"
              ? `${baseUrl}/api/system-skills/execute`
              : `${gatewayUrl}/api/skills/api`;
          const body = dispatch === "gateway" ? { toolName: "api_caller", arguments: args } : args;
          const response = await axios.post(url, body, { headers });
          return JSON.stringify(response.data);
        } catch (error) {
          return `Error calling API: ${formatToolError(error)}`;
        }
      },
    });
  }
}
