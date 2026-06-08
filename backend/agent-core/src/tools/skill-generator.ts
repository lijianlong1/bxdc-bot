/**
 * Skill 生成工具模块
 *
 * 模块职责：
 * - 提供 Skill 生成功能（通过自然语言描述创建 Extension Skill）
 * - 包含 Skill 生成器的 Zod Schema、类型定义和工具类
 * - 处理生成的 Skill 验证与保存
 *
 * 架构说明：
 * - 生成的 Skill 通过 `saveGeneratedSkill` 保存到 Gateway
 * - 调用 `gatewaySkillMutationHeaders` 构建请求头（共享工具函数在 java-skills.ts）
 * - 生成的 API/SSH Skill 执行走 `POST /api/skills/execute` 统一入口（由 java-skills.ts 的 `func` 处理）
 */

import { z } from "zod";
import axios from "axios";
import { pinyin } from "pinyin-pro";
import {
  DynamicStructuredTool,
  type StructuredTool,
} from "@langchain/core/tools";
import {
  formatToolError,
  type GatewaySkill,
  type SkillMutationPayload,
  type ExtendedSkillConfig,
  type AsyncPollConfig,
  readPreset,
  normalizeParameterBindingValue,
  normalizeParameterContractRequired,
  normalizeExtendedConfig,
  sanitizeConfigForDisplay,
  normalizeGeneratedOperation,
  gatewaySkillMutationHeaders,
  gatewaySkillReadHeaders,
  parseSkillConfig,
} from "./java-skills";

// ============================================================================
// Skill Generator — Zod Schemas
// ============================================================================

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
  z.any(),
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
  pollEndpoint: z.string(),
  idJsonPath: z.string().optional(),
  pollMethod: z.string().optional(),
  pollIntervalSeconds: z.number().int().min(1).optional(),
  maxWaitSeconds: z.number().int().min(1).optional(),
  completionJsonPath: z.string().optional(),
  completionValue: z.string().optional(),
  failedValues: z.array(z.string()).optional(),
  resultJsonPath: z.string().optional(),
  pollHeaders: z.record(z.string()).optional(),
}).optional());

/** Skill generator discriminated union - forces model to provide correct fields per targetType */
const skillGeneratorToolInputSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("api"),
    rawDescription: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    method: z.string().optional(),
    endpoint: z.string().optional(),
    headers: skillGeneratorHeadersSchema,
    query: skillGeneratorQuerySchema,
    body: z.any().optional(),
    interfaceDescription: z.string()
      .describe("Natural language description of the API's purpose, input/output fields, constraints, and usage notes for the LLM. Required for proper skill operation."),
    parameterContract: skillGeneratorParameterContractSchema
      .describe("JSON Schema object describing API parameters. Required. Each property supports: "
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
    /** Overrides default validation payload after save (e.g. { query: { env: "prod" } }). */
    testInput: skillGeneratorTestInputSchema,
    enabled: skillGeneratorBooleanOptionalSchema,
    requiresConfirmation: skillGeneratorBooleanOptionalSchema,
    allowOverwrite: skillGeneratorAllowOverwriteSchema,
  }),
  z.object({
    targetType: z.literal("ssh"),
    rawDescription: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    command: z.string().optional(),
    allowOverwrite: skillGeneratorAllowOverwriteSchema,
  }),
  z.object({
    targetType: z.literal("openclaw"),
    rawDescription: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    systemPrompt: z.string().optional(),
    allowedTools: z.preprocess(
      (v) => (typeof v === "string" ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : v; } catch { return v; } })() : v),
      z.array(z.string()),
    ).optional(),
    allowOverwrite: skillGeneratorAllowOverwriteSchema,
  }),
  z.object({
    targetType: z.literal("template"),
    rawDescription: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    prompt: z.string().optional(),
    allowOverwrite: skillGeneratorAllowOverwriteSchema,
  }),
]);

// ============================================================================
// Skill Generator — Types & Helpers
// ============================================================================

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

// ============================================================================
// Skill Generator — Save
// ============================================================================

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

// ============================================================================
// Skill Generator — Tool Class
// ============================================================================

/**
 * Skill 生成工具。
 *
 * 通过自然语言描述自动创建 Extension Skill（支持 api/ssh/openclaw/template 四种类型）。
 * 生成后保存到 Gateway，并返回创建结果。
 */
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
