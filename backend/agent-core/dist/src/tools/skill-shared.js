"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaApiTool = exports.JavaServerLookupTool = exports.JavaLinuxScriptTool = exports.JavaComputeTool = exports.JavaSshTool = exports.JavaSkillGeneratorTool = exports.sshExecutorToolInputSchema = exports.apiCallerToolInputSchema = exports.computeToolInputSchema = void 0;
exports.getAgentBuiltinSkillDispatch = getAgentBuiltinSkillDispatch;
exports.describeGatewayExtendedTool = describeGatewayExtendedTool;
exports.loadGatewayExtendedTools = loadGatewayExtendedTools;
exports.buildConfirmedToolInputString = buildConfirmedToolInputString;
exports.buildConfirmedToolArgs = buildConfirmedToolArgs;
exports.invokeExtendedSkillWithConfirmed = invokeExtendedSkillWithConfirmed;
const messages_1 = require("@langchain/core/messages");
const langgraph_1 = require("@langchain/langgraph");
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const pinyin_pro_1 = require("pinyin-pro");
const ajv = new ajv_1.default({ allErrors: true, useDefaults: true });
(0, ajv_formats_1.default)(ajv);
function getAgentBuiltinSkillDispatch() {
    const v = (process.env.AGENT_BUILTIN_SKILL_DISPATCH ?? "legacy").trim().toLowerCase();
    return v === "gateway" ? "gateway" : "legacy";
}
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
];
exports.computeToolInputSchema = zod_1.z.object({
    operation: zod_1.z
        .enum(COMPUTE_OPERATIONS)
        .describe("add|subtract|multiply|divide: two numbers in operands. factorial|square|sqrt: one number. timestamp_to_date: one Unix timestamp (seconds or ms). date_diff_days: two calendar dates as YYYY-MM-DD strings."),
    operands: zod_1.z
        .array(zod_1.z.union([zod_1.z.number(), zod_1.z.string()]))
        .min(1)
        .describe("add: [3,5]. subtract|multiply|divide: [a,b]. factorial|square|sqrt: [n]. timestamp_to_date: [unixTs]. date_diff_days: [\"2026-03-08\",\"2026-03-12\"]."),
});
const serverLookupToolInputSchema = zod_1.z.object({
    serverName: zod_1.z
        .string()
        .min(1)
        .describe("User-visible server name to search; returns up to 5 candidate serverId values (no credentials)."),
});
const linuxScriptToolInputSchema = zod_1.z.object({
    id: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .describe("Server ledger id from server_lookup.candidates[].id"),
    command: zod_1.z
        .string()
        .min(1)
        .describe("Shell command to execute on the server"),
});
exports.apiCallerToolInputSchema = zod_1.z.object({
    url: zod_1.z.string().url().describe("Full target URL"),
    method: zod_1.z
        .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
        .default("GET")
        .describe("HTTP method"),
    headers: zod_1.z
        .record(zod_1.z.string(), zod_1.z.string())
        .optional()
        .describe("Additional headers (Authorization, Content-Type, etc.)"),
    body: zod_1.z
        .any()
        .optional()
        .describe("Request body (object, string, or null)"),
});
exports.sshExecutorToolInputSchema = zod_1.z.object({
    host: zod_1.z.string().min(1).describe("SSH host (IP or hostname)"),
    username: zod_1.z.string().min(1).describe("SSH username"),
    command: zod_1.z.string().min(1).describe("Shell command to execute"),
    privateKey: zod_1.z.string().optional().describe("Private key content (PEM format) - mutually exclusive with password"),
    password: zod_1.z.string().optional().describe("Password for authentication - mutually exclusive with privateKey"),
    confirmed: zod_1.z
        .boolean()
        .default(false)
        .describe("Set to true to skip confirmation for potentially dangerous commands (rm -rf, reboot, etc.)"),
});
const skillGeneratorAllowOverwriteSchema = zod_1.z.preprocess((val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === "boolean")
        return val;
    if (typeof val === "string") {
        const v = val.trim().toLowerCase();
        if (v === "true" || v === "1" || v === "yes")
            return true;
        if (v === "false" || v === "0" || v === "no" || v === "")
            return false;
    }
    return val;
}, zod_1.z.boolean().optional().default(false));
function parseJsonObjectString(val) {
    if (val === undefined || val === null)
        return val;
    if (typeof val === "object" && !Array.isArray(val))
        return val;
    if (typeof val === "string") {
        const t = val.trim();
        if (!t)
            return undefined;
        try {
            const p = JSON.parse(t);
            if (p && typeof p === "object" && !Array.isArray(p))
                return p;
        }
        catch {
            return val;
        }
    }
    return val;
}
const skillGeneratorHeadersSchema = zod_1.z.preprocess((val) => parseJsonObjectString(val), zod_1.z.record(zod_1.z.string()).optional());
const skillGeneratorQuerySchema = zod_1.z.preprocess((val) => parseJsonObjectString(val), zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()])).optional());
const skillGeneratorTestInputSchema = zod_1.z.preprocess((val) => parseJsonObjectString(val), zod_1.z.record(zod_1.z.unknown()).optional());
const skillGeneratorParameterContractSchema = zod_1.z.preprocess((val) => parseJsonObjectString(val), zod_1.z.any());
const skillGeneratorBooleanOptionalSchema = zod_1.z.preprocess((val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === "boolean")
        return val;
    if (typeof val === "string") {
        const v = val.trim().toLowerCase();
        if (v === "true" || v === "1" || v === "yes")
            return true;
        if (v === "false" || v === "0" || v === "no" || v === "")
            return false;
    }
    return val;
}, zod_1.z.boolean().optional());
const skillGeneratorTimeoutSecondsSchema = zod_1.z.preprocess((val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === "number")
        return val;
    if (typeof val === "string") {
        const n = Number(val.trim());
        if (Number.isFinite(n))
            return n;
    }
    return val;
}, zod_1.z.number().int().min(1).max(3600).optional());
const skillGeneratorAsyncPollSchema = zod_1.z.preprocess((val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === "object" && !Array.isArray(val))
        return val;
    if (typeof val === "string") {
        try {
            const p = JSON.parse(val.trim());
            if (p && typeof p === "object" && !Array.isArray(p))
                return p;
        }
        catch {
            return val;
        }
    }
    return val;
}, zod_1.z.object({
    pollEndpoint: zod_1.z.string(),
    idJsonPath: zod_1.z.string().optional(),
    pollMethod: zod_1.z.string().optional(),
    pollIntervalSeconds: zod_1.z.number().int().min(1).optional(),
    maxWaitSeconds: zod_1.z.number().int().min(1).optional(),
    completionJsonPath: zod_1.z.string().optional(),
    completionValue: zod_1.z.string().optional(),
    failedValues: zod_1.z.array(zod_1.z.string()).optional(),
    resultJsonPath: zod_1.z.string().optional(),
    pollHeaders: zod_1.z.record(zod_1.z.string()).optional(),
}).optional());
const skillGeneratorToolInputSchema = zod_1.z.discriminatedUnion("targetType", [
    zod_1.z.object({
        targetType: zod_1.z.literal("api"),
        rawDescription: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        method: zod_1.z.string().optional(),
        endpoint: zod_1.z.string().optional(),
        headers: skillGeneratorHeadersSchema,
        query: skillGeneratorQuerySchema,
        body: zod_1.z.any().optional(),
        interfaceDescription: zod_1.z.string()
            .describe("Natural language description of the API's purpose, input/output fields, constraints, and usage notes for the LLM. Required for proper skill operation."),
        parameterContract: skillGeneratorParameterContractSchema
            .describe("JSON Schema object describing API parameters. Required. Each property supports: "
            + "type/description/required/default (standard JSON Schema), "
            + "enum: string[] OR [{label:string, value:string}][] (simple values or with display labels), "
            + "enumSource (optional): { url, method? (default GET), headers?, jsonPath?, valueKey? (default 'value'), labelKey? (default 'label'), searchParam?, refreshIntervalSec? (default 300) } "
            + "for dynamic dropdown options fetched from an API."),
        parameterBinding: zod_1.z.enum(["query", "jsonBody", "formBody"]).optional()
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
        allowOverwrite: skillGeneratorAllowOverwriteSchema,
    }),
    zod_1.z.object({
        targetType: zod_1.z.literal("ssh"),
        rawDescription: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        command: zod_1.z.string().optional(),
        allowOverwrite: skillGeneratorAllowOverwriteSchema,
    }),
    zod_1.z.object({
        targetType: zod_1.z.literal("openclaw"),
        rawDescription: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        systemPrompt: zod_1.z.string().optional(),
        allowedTools: zod_1.z.preprocess((v) => (typeof v === "string" ? (() => { try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p : v;
        }
        catch {
            return v;
        } })() : v), zod_1.z.array(zod_1.z.string())).optional(),
        allowOverwrite: skillGeneratorAllowOverwriteSchema,
    }),
    zod_1.z.object({
        targetType: zod_1.z.literal("template"),
        rawDescription: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        prompt: zod_1.z.string().optional(),
        allowOverwrite: skillGeneratorAllowOverwriteSchema,
    }),
]);
const tool_trace_context_1 = require("./tool-trace-context");
function formatToolError(error) {
    if (axios_1.default.isAxiosError(error)) {
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
            }
            catch {
                return `${baseMessage}${statusPart}`;
            }
        }
        return `${baseMessage}${statusPart}`;
    }
    if (error instanceof Error)
        return error.message || error.name;
    if (typeof error === 'string')
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
function readPreset(config) {
    const value = config.preset ?? config.profile;
    if (typeof value !== "string")
        return undefined;
    const normalized = value.trim();
    return normalized || undefined;
}
function isCurrentTimeSkillConfig(config) {
    const kind = (config.kind || "").toLowerCase();
    const operation = (config.operation || "").toLowerCase();
    const preset = (readPreset(config) || "").toLowerCase();
    return (kind === "time"
        || (kind === "api" && (preset === "current-time" || operation === "current-time"))
        || operation === "current-time");
}
function isServerMonitorSkillConfig(config) {
    const kind = (config.kind || "").toLowerCase();
    const operation = (config.operation || "").toLowerCase();
    const preset = (readPreset(config) || "").toLowerCase();
    return (kind === "monitor"
        || (kind === "ssh" && (preset === "server-resource-status" || operation === "server-resource-status"))
        || operation === "server-resource-status");
}
const extendedSshSkillToolSchema = zod_1.z.object({
    id: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .describe("Server ledger id from server_lookup.candidates[].id after disambiguation when needed."),
});
const extendedTemplateSkillToolSchema = zod_1.z.object({
    input: zod_1.z.string().optional().describe("User message or parameters for this template skill."),
}).passthrough();
const extendedOpenClawSkillToolSchema = zod_1.z.object({
    input: zod_1.z.string().optional().describe("User goal or parameters for the OPENCLAW planner."),
});
const extendedApiSkillLooseSchema = zod_1.z
    .record(zod_1.z.string(), zod_1.z.any())
    .describe("API parameters as top-level fields; must match the skill parameter contract (JSON Schema). "
    + "Defaults from the contract apply when keys are omitted.");
const extendedPassthroughSkillToolSchema = zod_1.z.object({}).passthrough();
const extendedSkillConfirmationField = zod_1.z.object({
    confirmed: zod_1.z
        .boolean()
        .optional()
        .describe("Set by the confirmation UI when resuming; omit for normal calls."),
});
function withOptionalConfirmationFlag(schema) {
    if (schema instanceof zod_1.z.ZodObject) {
        return schema.merge(extendedSkillConfirmationField);
    }
    return zod_1.z.intersection(schema, extendedSkillConfirmationField);
}
function buildSkillZodSchema(config, schemaProps) {
    const executionMode = config.orchestration?.mode;
    if (executionMode === "OPENCLAW" || (config.kind || "").toLowerCase() === "openclaw") {
        return withOptionalConfirmationFlag(extendedOpenClawSkillToolSchema);
    }
    if (!schemaProps || Object.keys(schemaProps).length === 0) {
        return withOptionalConfirmationFlag(extendedPassthroughSkillToolSchema);
    }
    const shape = {};
    for (const [key, prop] of Object.entries(schemaProps)) {
        const desc = prop.description || key;
        const hasConst = "const" in prop;
        const hasDefault = "default" in prop;
        const isRequired = prop.required === true;
        const rawEnum = prop.enum;
        const enumValues = Array.isArray(rawEnum)
            ? rawEnum.map((v) => (typeof v === "object" && v !== null && "value" in v) ? v.value : v)
            : undefined;
        let descWithMeta = desc;
        if (hasConst)
            descWithMeta += " (fixed value, omit)";
        let field;
        if (prop.type === "number" || prop.type === "integer") {
            let baseField;
            if (enumValues && enumValues.length > 0) {
                const enumStrs = enumValues.map(String);
                baseField = zod_1.z.enum([enumStrs[0], ...enumStrs.slice(1)]).transform(Number);
            }
            else {
                baseField = zod_1.z.number();
            }
            if (hasDefault) {
                field = baseField.default(prop.default);
            }
            else if (isRequired) {
                field = baseField;
            }
            else {
                field = baseField.optional();
            }
        }
        else if (prop.type === "boolean") {
            let baseField = zod_1.z.boolean();
            if (hasDefault) {
                field = baseField.default(prop.default);
            }
            else if (isRequired) {
                field = baseField;
            }
            else {
                field = baseField.optional();
            }
        }
        else {
            let baseField;
            if (enumValues && enumValues.length > 0) {
                const enumStrs = enumValues.map(String);
                baseField = zod_1.z.enum([enumStrs[0], ...enumStrs.slice(1)]);
            }
            else {
                baseField = zod_1.z.string();
            }
            if (hasDefault) {
                field = baseField.default(prop.default);
            }
            else if (isRequired) {
                field = baseField;
            }
            else {
                field = baseField.optional();
            }
        }
        shape[key] = field.describe(descWithMeta);
    }
    return withOptionalConfirmationFlag(zod_1.z.object(shape).passthrough());
}
const gatewayExtendedToolRegistry = new Map();
const gatewayExtendedToolIdRegistry = new Map();
function normalizeToolName(name, id) {
    let processedName = name;
    if (/[\u4e00-\u9fff]/.test(name)) {
        try {
            processedName = (0, pinyin_pro_1.pinyin)(name, { toneType: "none", type: "array" }).join(" ");
        }
        catch {
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
function normalizeExecutionMode(executionMode) {
    return executionMode?.toUpperCase() === "OPENCLAW" ? "OPENCLAW" : "CONFIG";
}
function localizeExecutionMode(executionMode) {
    return normalizeExecutionMode(executionMode) === "OPENCLAW" ? "自主规划" : "预配置";
}
function registerGatewayToolMetadata(toolName, skill) {
    const metadata = {
        displayName: skill.name || `skill_${skill.id}`,
        executionMode: normalizeExecutionMode(skill.executionMode),
        executionLabel: localizeExecutionMode(skill.executionMode),
    };
    gatewayExtendedToolRegistry.set(toolName, metadata);
    gatewayExtendedToolRegistry.set(toolName.replace(/_/g, "-"), metadata);
    gatewayExtendedToolIdRegistry.set(skill.id, metadata);
}
function describeGatewayExtendedTool(toolName) {
    const metadata = gatewayExtendedToolRegistry.get(toolName)
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
    const idMatch = toolName.match(/(\d+)$/);
    if (!idMatch)
        return null;
    const skillId = Number(idMatch[1]);
    if (!Number.isFinite(skillId))
        return null;
    const idDisplayName = gatewayExtendedToolIdRegistry.get(skillId);
    if (!idDisplayName)
        return null;
    return {
        displayName: idDisplayName.displayName,
        kind: 'skill',
        executionMode: idDisplayName.executionMode,
        executionLabel: idDisplayName.executionLabel,
    };
}
function normalizeParameterBindingValue(raw) {
    if (raw === "jsonBody" || raw === "query" || raw === "formBody")
        return raw;
    return undefined;
}
function normalizeExtendedConfig(cfg) {
    const next = { ...cfg };
    const pb = normalizeParameterBindingValue(cfg.parameterBinding);
    if (pb) {
        next.parameterBinding = pb;
    }
    else {
        delete next.parameterBinding;
    }
    const rawPc = cfg.parameterContract;
    if (typeof rawPc === "string" && rawPc.trim()) {
        try {
            const parsed = JSON.parse(rawPc);
            if (parsed && typeof parsed === "object") {
                next.parameterContract = parsed;
            }
        }
        catch {
        }
    }
    return next;
}
function parseSkillConfig(skill) {
    if (!skill.configuration || !skill.configuration.trim())
        return {};
    try {
        const parsed = JSON.parse(skill.configuration);
        if (!parsed || typeof parsed !== "object")
            return {};
        return normalizeExtendedConfig(parsed);
    }
    catch {
        return {};
    }
}
const LLM_API_SKILL_STRUCTURED_HINT = "Tool call: pass parameters as **top-level** fields matching the parameter contract below (structured tool schema). "
    + "Do not nest the whole payload under a single `input` string.\n\n";
function appendInterfaceDescriptionTail(base, config) {
    const extra = config.interfaceDescription?.trim();
    if (!extra)
        return base;
    return base.includes(extra) ? base : `${base}\n\n${extra}`;
}
function appendParameterContractToToolDescription(baseDescription, config) {
    const contract = config.parameterContract;
    if (!contract || typeof contract !== "object") {
        return appendInterfaceDescriptionTail(baseDescription, config);
    }
    const props = contract.type === "object"
        && contract.properties
        && typeof contract.properties === "object"
        && !Array.isArray(contract.properties)
        ? contract.properties
        : null;
    if (props && Object.keys(props).length > 0) {
        const requiredList = Array.isArray(contract.required) ? contract.required : [];
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
        return appendInterfaceDescriptionTail(`${baseDescription}\n\n${LLM_API_SKILL_STRUCTURED_HINT}Parameters:\n${lines}`, config);
    }
    try {
        return appendInterfaceDescriptionTail(`${baseDescription}\n\n${LLM_API_SKILL_STRUCTURED_HINT}Parameter contract (JSON Schema):\n${JSON.stringify(contract, null, 2)}`, config);
    }
    catch {
        return appendInterfaceDescriptionTail(baseDescription, config);
    }
}
function parseCheckTimePayload(payload) {
    if (typeof payload === "string") {
        const match = payload.match(/QZOutputJson=\{.*?"t"\s*:\s*"?(?<ts>\d{10,13})"?/);
        const tsRaw = match?.groups?.ts;
        if (!tsRaw)
            return null;
        const tsNum = Number(tsRaw);
        if (!Number.isFinite(tsNum))
            return null;
        const timestampMs = tsNum < 1e12 ? tsNum * 1000 : tsNum;
        return { timestamp: tsNum, isoTime: new Date(timestampMs).toISOString() };
    }
    if (payload && typeof payload === "object") {
        const direct = payload.t;
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
function parseToolInput(input) {
    if (!input?.trim())
        return {};
    try {
        const parsed = JSON.parse(input);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function normalizeApiSkillPayload(payload) {
    const next = { ...payload };
    const rawInput = next.input;
    if (typeof rawInput === "string" && rawInput.trim()) {
        try {
            const inner = JSON.parse(rawInput.trim());
            if (inner && typeof inner === "object" && !Array.isArray(inner)) {
                delete next.input;
                return { ...inner, ...next };
            }
        }
        catch {
        }
    }
    return next;
}
function pushScalarDefault(out, key, value) {
    if (value === undefined)
        return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        out[key] = value;
    }
}
function normalizeEnumForValidation(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((item) => {
        if (typeof item === 'string')
            return item;
        if (item && typeof item === 'object' && 'value' in item)
            return item.value;
        return item;
    });
}
function normalizeParameterContractRequired(contract) {
    const out = { ...contract };
    const props = out.properties;
    if (!props)
        return out;
    const existingRequired = Array.isArray(out.required) ? out.required : [];
    const requiredSet = new Set(existingRequired);
    const normalizedProps = {};
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
    }
    else {
        delete out.required;
    }
    return out;
}
function normalizeParameterContractForValidation(contract) {
    let out = normalizeParameterContractRequired(contract);
    const props = out.properties;
    if (!props)
        return out;
    const normalizedProps = {};
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
function collectParameterDefaults(parameterContract) {
    const out = {};
    if (!parameterContract || typeof parameterContract !== "object" || Array.isArray(parameterContract)) {
        return out;
    }
    const pc = parameterContract;
    if (pc.type === "object"
        && pc.properties
        && typeof pc.properties === "object"
        && !Array.isArray(pc.properties)) {
        const props = pc.properties;
        for (const [key, spec] of Object.entries(props)) {
            if (!spec || typeof spec !== "object")
                continue;
            pushScalarDefault(out, key, spec.default);
        }
        return out;
    }
    for (const [key, spec] of Object.entries(pc)) {
        if (key === "required" && Array.isArray(spec))
            continue;
        if (!spec || typeof spec !== "object" || Array.isArray(spec))
            continue;
        pushScalarDefault(out, key, spec.default);
    }
    return out;
}
function normalizeGeneratedOperation(value) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return normalized || "api_request";
}
function deriveSkillName(input) {
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
            if (candidate)
                return `API ${candidate}`;
        }
        catch {
        }
    }
    if (input.targetType === "ssh" && typeof input.command === "string" && input.command.trim()) {
        const firstWord = input.command.trim().split(/\s+/)[0];
        if (firstWord)
            return `SSH ${firstWord}`;
    }
    if (input.targetType === "openclaw") {
        return "Generated OPENCLAW Skill";
    }
    if (input.targetType === "template") {
        return "Generated Template Skill";
    }
    return "Generated Skill";
}
function deriveSkillDescription(input, name) {
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
function sanitizeConfigForDisplay(config) {
    return config;
}
function buildValidationSummary(result) {
    if (result.startsWith("Error ")) {
        return {
            success: false,
            error: result,
        };
    }
    try {
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
            return {
                success: false,
                parsed,
                error: String(parsed.error || "Validation failed"),
            };
        }
        return {
            success: true,
            parsed,
        };
    }
    catch {
        return {
            success: true,
            raw: result,
        };
    }
}
function buildGeneratedSkill(input) {
    const missingFields = [];
    const targetType = input.targetType || "api";
    if (targetType === "api") {
        const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
        const method = typeof input.method === "string" ? input.method.trim().toUpperCase() : "";
        if (!endpoint)
            missingFields.push("endpoint");
        if (!method)
            missingFields.push("method");
        if (!input.interfaceDescription?.trim())
            missingFields.push("interfaceDescription");
        if (!input.parameterContract)
            missingFields.push("parameterContract");
        if (endpoint) {
            try {
                new URL(endpoint);
            }
            catch {
                missingFields.push("endpoint(valid URL)");
            }
        }
    }
    else if (targetType === "ssh") {
        if (!input.command?.trim()) {
            missingFields.push("command");
        }
    }
    else if (targetType === "openclaw") {
        if (!input.systemPrompt?.trim()) {
            missingFields.push("systemPrompt");
        }
    }
    else if (targetType === "template") {
        if (!input.prompt?.trim()) {
            missingFields.push("prompt");
        }
    }
    else {
        missingFields.push("targetType(api|ssh|openclaw|template)");
    }
    if (missingFields.length > 0) {
        return { missingFields };
    }
    function pickGeneratedSkillAvatar(kind) {
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
    let config = {};
    let executionMode = "CONFIG";
    if (targetType === "api") {
        const rawPc = input.parameterContract;
        let parameterContract = typeof rawPc === "string"
            ? (() => { try {
                const p = JSON.parse(rawPc);
                return (p && typeof p === "object") ? p : rawPc;
            }
            catch {
                return rawPc;
            } })()
            : rawPc;
        if (parameterContract && typeof parameterContract === "object" && !Array.isArray(parameterContract)) {
            parameterContract = normalizeParameterContractRequired(parameterContract);
        }
        const methodUpper = typeof input.method === "string" ? input.method.trim().toUpperCase() : "";
        const resolvedBinding = normalizeParameterBindingValue(input.parameterBinding)
            ?? (["POST", "PUT", "PATCH", "DELETE"].includes(methodUpper) ? "jsonBody" : undefined);
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
    }
    else if (targetType === "ssh") {
        config = {
            kind: "ssh",
            preset: "server-resource-status",
            operation: "server-resource-status",
            lookup: "server_lookup",
            executor: "linux_script_executor",
            command: input.command?.trim(),
            interfaceDescription: "Two-step: (1) server_lookup with `serverName` to get up to 5 candidates (`id` + `name`); if one, use its `id`; if several, ask the user, then (2) call this tool with top-level `id` only. "
                + "The shell command is fixed in this skill configuration and is not a tool parameter.",
        };
    }
    else if (targetType === "openclaw") {
        executionMode = "OPENCLAW";
        config = {
            kind: "openclaw",
            systemPrompt: input.systemPrompt?.trim(),
            allowedTools: input.allowedTools || [],
            orchestration: { mode: "serial" },
        };
    }
    else if (targetType === "template") {
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
function toQueryRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    return Object.entries(value).reduce((acc, [key, item]) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
            acc[key] = item;
        }
        return acc;
    }, {});
}
function buildUrlWithQuery(endpoint, query) {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}
async function executeCurrentTimeSkill(gatewayUrl, apiToken, userId, config, skillId) {
    const endpoint = config.endpoint || "https://vv.video.qq.com/checktime?otype=json";
    const method = (config.method || "GET").toUpperCase();
    const response = await axios_1.default.post(`${gatewayUrl}/api/skills/api`, {
        url: endpoint,
        method,
        headers: {},
        body: "",
    }, {
        headers: gatewayApiProxyInboundHeaders(apiToken, userId, skillId),
    });
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
function parseSshSkillPayload(input) {
    if (input && typeof input === "object" && !Array.isArray(input)) {
        return { ...input };
    }
    if (typeof input === "string") {
        const t = input.trim();
        if (!t)
            return {};
        try {
            const parsed = JSON.parse(t);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : { id: t };
        }
        catch {
            return { id: t };
        }
    }
    return {};
}
async function executeServerResourceStatusSkill(gatewayUrl, apiToken, userId, input, config, skillId) {
    const payload = parseSshSkillPayload(input);
    const rawId = payload.id ?? payload.serverId;
    const idNum = typeof rawId === "number" && Number.isFinite(rawId)
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
    const headers = {
        "X-Agent-Token": apiToken,
        "Content-Type": "application/json",
        "X-User-Id": userId,
        ...optionalSkillIdHeader(skillId),
    };
    const response = await axios_1.default.post(`${gatewayUrl}/api/skills/linux-script`, { id: idNum, command }, { headers });
    if (typeof response.data === "string") {
        return response.data;
    }
    if (response.data && typeof response.data.result === "string") {
        return response.data.result;
    }
    return JSON.stringify(response.data);
}
function collectMergedScalarFields(merged) {
    const out = {};
    for (const [key, value] of Object.entries(merged)) {
        if (["query", "headers", "body"].includes(key))
            continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            out[key] = value;
        }
        else if (Array.isArray(value)) {
            out[key] = value;
        }
    }
    return out;
}
function isMethodAllowingJsonBodyBinding(method) {
    const m = method.toUpperCase();
    return m !== "GET" && m !== "HEAD";
}
function mergeJsonBodyForProxy(merged, flatScalars) {
    let bodyObj = { ...flatScalars };
    const raw = merged.body;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        bodyObj = { ...bodyObj, ...raw };
    }
    else if (typeof raw === "string" && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                bodyObj = { ...bodyObj, ...parsed };
            }
        }
        catch {
        }
    }
    return bodyObj;
}
function isFormUrlEncodableScalar(v) {
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}
function formUrlEncodeFlatBodyObject(bodyObj) {
    for (const [key, v] of Object.entries(bodyObj)) {
        if (!isFormUrlEncodableScalar(v) && !Array.isArray(v)) {
            return {
                ok: false,
                error: "Parameter value not allowed for formBody binding: only flat string, number, boolean, or array values are supported. "
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
        }
        else {
            params.set(k, String(v));
        }
    }
    return { ok: true, body: params.toString() };
}
function mergeHeadersForApiProxy(configHeaders, method, outboundBody) {
    const out = { ...(configHeaders || {}) };
    if (outboundBody === "none")
        return out;
    const m = method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(m))
        return out;
    if (outboundBody === "json") {
        out["Content-Type"] = "application/json";
    }
    else {
        out["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";
    }
    return out;
}
function validateTimeoutSeconds(raw) {
    const DEFAULT_TIMEOUT = 30;
    const MAX_TIMEOUT = 3600;
    if (raw === undefined || raw === null)
        return DEFAULT_TIMEOUT;
    if (typeof raw !== "number" || !Number.isFinite(raw))
        return DEFAULT_TIMEOUT;
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
function coerceMergedTypes(merged, properties) {
    for (const [key, prop] of Object.entries(properties)) {
        const val = merged[key];
        if (val === undefined || val === null)
            continue;
        if (typeof val === "string" && prop.type === "number") {
            const n = Number(val);
            if (Number.isFinite(n)) {
                merged[key] = n;
            }
        }
        else if (typeof val === "string" && prop.type === "boolean") {
            const lower = val.trim().toLowerCase();
            if (lower === "true" || lower === "1" || lower === "yes") {
                merged[key] = true;
            }
            else if (lower === "false" || lower === "0" || lower === "no" || lower === "") {
                merged[key] = false;
            }
        }
        else if (typeof val === "string" && prop.type === "array") {
            const trimmed = val.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        merged[key] = parsed;
                    }
                }
                catch {
                }
            }
        }
        else if (typeof val === "string" && prop.type === "integer") {
            const n = parseInt(val, 10);
            if (Number.isFinite(n)) {
                merged[key] = n;
            }
        }
    }
}
async function executeConfiguredApiSkill(gatewayUrl, apiToken, userId, input, config, skillId, sessionId) {
    const method = (config.method || "GET").toUpperCase();
    let payload;
    if (typeof input === "string") {
        payload = parseToolInput(input);
    }
    else if (input && typeof input === "object" && !Array.isArray(input)) {
        payload = { ...input };
    }
    else {
        payload = {};
    }
    payload = normalizeApiSkillPayload(payload);
    const defaults = collectParameterDefaults(config.parameterContract);
    const merged = { ...defaults, ...payload };
    if (config.parameterContract && config.parameterContract.properties) {
        coerceMergedTypes(merged, config.parameterContract.properties);
    }
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
            if (["query", "headers", "body"].includes(key))
                continue;
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                query[key] = value;
            }
        }
    }
    const endpoint = config.endpoint ? buildUrlWithQuery(config.endpoint, query) : "";
    if (!endpoint) {
        return JSON.stringify({ error: "No endpoint configured for API skill" });
    }
    let outboundBody = "none";
    let requestBody = merged.body ?? "";
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
    }
    else if (useJsonBody) {
        requestBody = mergeJsonBodyForProxy(merged, flatScalars);
        outboundBody = "json";
    }
    const headersOut = mergeHeadersForApiProxy(config.headers, method, outboundBody);
    const timeoutSeconds = validateTimeoutSeconds(config.timeoutSeconds);
    try {
        const response = await axios_1.default.post(`${gatewayUrl}/api/skills/api`, {
            url: endpoint,
            method,
            headers: headersOut,
            body: requestBody,
            timeoutSeconds,
        }, {
            headers: gatewayApiProxyInboundHeaders(apiToken, userId, skillId, sessionId),
            timeout: (timeoutSeconds + 5) * 1000,
        });
        return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
            if (isTimeout) {
                return JSON.stringify({
                    error: "API Skill HTTP request timed out",
                    timeoutSeconds,
                    hint: `The request exceeded the configured timeout of ${timeoutSeconds} seconds. `
                        + "You may ask the user if they want to increase timeoutSeconds or configure asyncPoll for long-running tasks.",
                });
            }
            const details = typeof data === "string"
                ? data
                : data !== undefined && data !== null
                    ? JSON.stringify(data)
                    : error.message;
            return JSON.stringify({
                error: "Gateway API proxy request failed",
                status: status ?? null,
                details,
                hint: "The Skill Gateway could not complete the HTTP call (network, timeout, or upstream error). "
                    + "Fix connectivity or URL and retry this skill invocation.",
            });
        }
        throw error;
    }
}
async function executeConfiguredApiSkillAsync(gatewayUrl, apiToken, userId, endpoint, method, headersOut, requestBody, timeoutSeconds, asyncPoll, skillId, sessionId) {
    const auditHeaders = gatewayApiProxyInboundHeaders(apiToken, userId, skillId, sessionId);
    try {
        const submitResponse = await axios_1.default.post(`${gatewayUrl}/api/skills/api/async`, {
            url: endpoint,
            method,
            headers: headersOut,
            body: requestBody,
            timeoutSeconds,
            asyncPoll,
        }, {
            headers: auditHeaders,
            timeout: (timeoutSeconds + 5) * 1000,
        });
        const { asyncTaskId, externalTaskId } = submitResponse.data;
        if (!asyncTaskId) {
            return JSON.stringify({
                error: "Async task submission failed",
                details: submitResponse.data,
            });
        }
        const maxWaitMs = asyncPoll.maxWaitSeconds
            ? asyncPoll.maxWaitSeconds * 1000
            : (asyncPoll.maxWaitMs || 600000);
        postPollingAudit(gatewayUrl, auditHeaders, {
            asyncTaskId,
            skillId,
            userId,
            sessionId,
            phase: "AGENT_REQUEST",
            extraJson: JSON.stringify({ timeoutMs: maxWaitMs, pollMethod: asyncPoll.pollMethod || "GET" }),
        });
        const waitResponse = await axios_1.default.get(`${gatewayUrl}/api/skills/async-tasks/${asyncTaskId}/wait`, {
            params: { timeoutMs: maxWaitMs },
            headers: auditHeaders,
            timeout: maxWaitMs + 10000,
        });
        const { status, result, errorMessage } = waitResponse.data;
        postPollingAudit(gatewayUrl, auditHeaders, {
            asyncTaskId,
            skillId,
            userId,
            sessionId,
            phase: "AGENT_RESPONSE",
            responseBody: JSON.stringify(waitResponse.data),
            status,
        });
        if (status === "COMPLETED") {
            return JSON.stringify({
                asyncTaskId,
                externalTaskId,
                status: "COMPLETED",
                result: result ? (typeof result === "string" ? tryParseJson(result) ?? result : result) : null,
                note: `Async task ${externalTaskId || asyncTaskId} completed successfully. Present the result to the user.`,
            });
        }
        if (status === "FAILED") {
            return JSON.stringify({
                asyncTaskId,
                externalTaskId,
                status: "FAILED",
                error: errorMessage || "Task execution failed",
            });
        }
        if (status === "TIMEOUT") {
            return JSON.stringify({
                asyncTaskId,
                externalTaskId,
                status: "TIMEOUT",
                error: errorMessage || "Task timed out",
            });
        }
        return JSON.stringify({
            asyncTaskId,
            externalTaskId,
            status: status || "POLLING",
            result: null,
            hint: `The task (${externalTaskId || asyncTaskId}) is still being processed. You can check the status later or wait for it to complete.`,
        });
    }
    catch (error) {
        const auditLog = {
            skillId,
            userId,
            sessionId,
            phase: "AGENT_ERROR",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
        };
        if (axios_1.default.isAxiosError(error)) {
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
        if (axios_1.default.isAxiosError(error)) {
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
function postPollingAudit(gatewayUrl, headers, log) {
    axios_1.default.post(`${gatewayUrl}/api/internal/polling-audit/events`, [{
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
        }], {
        headers,
        timeout: 5000,
    }).catch(() => {
    });
}
function tryParseJson(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return raw;
    }
}
async function invokeToolDirect(tool, input) {
    const callableTool = tool;
    let rawResult;
    if ((0, tools_1.isStructuredTool)(tool)) {
        const parsed = typeof input === "string"
            ? JSON.parse(input.trim() || "{}")
            : input !== undefined && input !== null && typeof input === "object"
                ? input
                : {};
        rawResult = await tool.invoke(parsed);
    }
    else {
        const serializedInput = typeof input === "string" ? input : JSON.stringify(input ?? {});
        rawResult = callableTool.func
            ? await callableTool.func(serializedInput)
            : await callableTool.invoke(serializedInput);
    }
    if (typeof rawResult === "string")
        return rawResult;
    if (rawResult && typeof rawResult === "object") {
        const c = rawResult.content;
        if (typeof c === "string")
            return c;
    }
    return JSON.stringify(rawResult ?? "");
}
function summarizeToolResult(result) {
    const trimmed = result.trim();
    if (!trimmed)
        return undefined;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
            if (typeof parsed.error === "string") {
                return String(parsed.error);
            }
            if (typeof parsed.result === "string") {
                return String(parsed.result);
            }
            if (typeof parsed.readableTime === "string") {
                return String(parsed.readableTime);
            }
        }
    }
    catch {
    }
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}
function resolveAllowedTools(allowedTools, toolLookup) {
    const names = Array.isArray(allowedTools) ? allowedTools : [];
    const resolved = names
        .map((name) => toolLookup.get(name) ?? toolLookup.get(name.trim()) ?? toolLookup.get(name.replace(/-/g, "_")))
        .filter(Boolean);
    const deduped = new Map();
    resolved.forEach((tool) => deduped.set(tool.name, tool));
    return Array.from(deduped.values());
}
async function executeOpenClawSkill(plannerModel, parentToolName, input, config, availableTools) {
    const orchestrationMode = config.orchestration?.mode || "serial";
    if (orchestrationMode !== "serial") {
        return JSON.stringify({ error: `Unsupported OPENCLAW orchestration mode: ${orchestrationMode}` });
    }
    const availableToolLookup = new Map();
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
    const missingTools = (config.allowedTools || []).filter((name) => (!availableToolLookup.get(name)
        && !availableToolLookup.get(name.trim())
        && !availableToolLookup.get(name.replace(/-/g, "_"))));
    if (missingTools.length > 0) {
        return JSON.stringify({ error: `OPENCLAW skill is missing required tools: ${missingTools.join(", ")}` });
    }
    const parentToolId = (0, tool_trace_context_1.getActiveParentToolId)(parentToolName);
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
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: input || "{}" },
    ];
    for (let round = 0; round < 6; round += 1) {
        const response = await planner.invoke(messages);
        const rawToolCalls = Array.isArray(response?.tool_calls) ? response.tool_calls : [];
        let toolCalls = rawToolCalls;
        if (orchestrationMode === "serial" && rawToolCalls.length > 1) {
            toolCalls = [rawToolCalls[0]];
            messages.push(new messages_1.AIMessage({
                content: response.content ?? "",
                tool_calls: toolCalls,
            }));
        }
        else {
            messages.push(response);
        }
        if (toolCalls.length === 0) {
            const content = response?.content;
            if (typeof content === "string")
                return content;
            if (Array.isArray(content)) {
                return content
                    .map((part) => typeof part === "string" ? part : part?.text || "")
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
            (0, tool_trace_context_1.emitToolTraceEvent)({
                type: "tool_status",
                toolId: childToolId,
                toolName: tool.name,
                displayName: childDisplayName,
                kind: describeGatewayExtendedTool(tool.name)?.kind || "tool",
                status: "running",
                parentToolId,
                parentToolName,
                arguments: (0, tool_trace_context_1.sanitizeToolTraceArguments)(toolCall.args || {}),
            });
            try {
                const result = await invokeToolDirect(tool, toolCall.args || {});
                (0, tool_trace_context_1.emitToolTraceEvent)({
                    type: "tool_status",
                    toolId: childToolId,
                    toolName: tool.name,
                    displayName: childDisplayName,
                    kind: describeGatewayExtendedTool(tool.name)?.kind || "tool",
                    status: "completed",
                    parentToolId,
                    parentToolName,
                    summary: summarizeToolResult(result),
                    result: (0, tool_trace_context_1.sanitizeToolResultForTrace)(result),
                });
                const resolvedCallId = typeof toolCall.id === "string" && toolCall.id.trim() ? toolCall.id : childToolId;
                messages.push({
                    role: "tool",
                    tool_call_id: resolvedCallId,
                    content: result,
                });
            }
            catch (error) {
                if ((0, langgraph_1.isGraphInterrupt)(error))
                    throw error;
                const message = formatToolError(error);
                (0, tool_trace_context_1.emitToolTraceEvent)({
                    type: "tool_status",
                    toolId: childToolId,
                    toolName: tool.name,
                    displayName: childDisplayName,
                    kind: describeGatewayExtendedTool(tool.name)?.kind || "tool",
                    status: "failed",
                    parentToolId,
                    parentToolName,
                    summary: message,
                    result: (0, tool_trace_context_1.sanitizeToolResultForTrace)(message),
                });
                const resolvedCallId = typeof toolCall.id === "string" && toolCall.id.trim() ? toolCall.id : childToolId;
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
function gatewaySkillMutationHeaders(apiToken, userId, sessionId) {
    const headers = {
        "X-Agent-Token": apiToken,
        "Content-Type": "application/json",
    };
    if (userId && String(userId).trim()) {
        headers["X-User-Id"] = String(userId).trim();
    }
    if (sessionId && String(sessionId).trim()) {
        headers["X-Session-Id"] = String(sessionId).trim();
    }
    return headers;
}
function gatewaySkillReadHeaders(apiToken, userId) {
    const headers = {
        "X-Agent-Token": apiToken,
    };
    if (userId && String(userId).trim()) {
        headers["X-User-Id"] = String(userId).trim();
    }
    return headers;
}
function optionalSkillIdHeader(skillId) {
    if (skillId !== undefined && Number.isFinite(skillId) && skillId > 0) {
        return { "X-Skill-Id": String(Math.trunc(skillId)) };
    }
    return {};
}
function gatewayApiProxyInboundHeaders(apiToken, userId, skillId, sessionId) {
    return {
        ...gatewaySkillReadHeaders(apiToken, userId),
        "Content-Type": "application/json",
        ...optionalSkillIdHeader(skillId),
        ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    };
}
function previewExtendedSkillToolInput(rawInput) {
    if (rawInput === undefined || rawInput === null)
        return {};
    if (typeof rawInput === "object" && !Array.isArray(rawInput))
        return rawInput;
    if (typeof rawInput === "string") {
        const t = rawInput.trim();
        if (!t)
            return {};
        try {
            return JSON.parse(t);
        }
        catch {
            return rawInput;
        }
    }
    return rawInput;
}
function parseExtendedSkillConfirmationInput(input) {
    const trimmed = (input ?? "").trim();
    if (!trimmed) {
        return { confirmed: false, executionInput: "" };
    }
    try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj === "object" && !Array.isArray(obj) && "confirmed" in obj) {
            const confirmed = Boolean(obj.confirmed);
            const rest = { ...obj };
            delete rest.confirmed;
            const executionInput = Object.keys(rest).length > 0 ? JSON.stringify(rest) : "";
            return { confirmed, executionInput };
        }
    }
    catch {
    }
    return { confirmed: false, executionInput: trimmed };
}
function applyExtendedSkillConfirmationGate(execInput, needsConfirmation, runConfig, toolName, currentSkill) {
    if (!needsConfirmation) {
        return { proceed: true, payload: execInput };
    }
    const o = execInput && typeof execInput === "object" && !Array.isArray(execInput)
        ? execInput
        : null;
    if (o && "confirmed" in o) {
        if (!Boolean(o.confirmed)) {
            return { proceed: false, cancelled: true };
        }
        const rest = { ...o };
        delete rest.confirmed;
        return { proceed: true, payload: rest };
    }
    const tc = runConfig?.toolCall;
    const toolCallId = (typeof tc?.id === "string" && tc.id.trim())
        ? tc.id.trim()
        : `${toolName}:pending`;
    const resume = (0, langgraph_1.interrupt)({
        kind: "extended_skill_confirmation",
        toolName,
        toolCallId,
        skillName: currentSkill.name || toolName,
        skillId: currentSkill.id,
        summary: `Execute extended skill: ${currentSkill.name || toolName}`,
        details: "",
        parametersPreview: previewExtendedSkillToolInput(execInput),
    });
    const result = resume;
    if (!result.confirmed) {
        return { proceed: false, cancelled: true };
    }
    const finalInput = result.adjustedParams
        ? { ...execInput, ...result.adjustedParams }
        : execInput;
    if (result.adjustedParams && Object.keys(result.adjustedParams).length > 0) {
        console.log(`[skill-confirm] tool=${toolName} adjustedParams keys=${JSON.stringify(Object.keys(result.adjustedParams))} sample=${JSON.stringify(result.adjustedParams).slice(0, 200)}`);
    }
    return { proceed: true, payload: finalInput };
}
async function saveGeneratedSkill(gatewayUrl, apiToken, payload, allowOverwrite, userId) {
    const headers = gatewaySkillMutationHeaders(apiToken, userId);
    const readHeaders = gatewaySkillReadHeaders(apiToken, userId);
    try {
        const existingSkillsResponse = await axios_1.default.get(`${gatewayUrl}/api/skills`, { headers: readHeaders });
        const existingSkills = Array.isArray(existingSkillsResponse.data) ? existingSkillsResponse.data : [];
        const existingSkill = existingSkills.find((entry) => entry.name === payload.name);
        if (!existingSkill) {
            const created = await axios_1.default.post(`${gatewayUrl}/api/skills`, payload, { headers });
            return {
                mode: "created",
                skill: created.data,
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
        const updated = await axios_1.default.put(`${gatewayUrl}/api/skills/${existingSkill.id}`, payload, { headers });
        return {
            mode: "updated",
            skill: updated.data,
        };
    }
    catch (error) {
        return {
            status: "save_failed",
            error: formatToolError(error),
        };
    }
}
async function loadGatewayExtendedTools(gatewayUrl, apiToken, userId, options) {
    try {
        const listHeaders = gatewaySkillReadHeaders(apiToken, userId);
        const response = await axios_1.default.get(`${gatewayUrl}/api/skills`, {
            headers: listHeaders,
        });
        const skills = Array.isArray(response.data) ? response.data : [];
        const extensionSkills = skills.filter((skill) => skill.enabled && (skill.type || "").toUpperCase() === "EXTENSION");
        const toolLookup = new Map();
        (options?.availableTools || []).forEach((tool) => {
            toolLookup.set(tool.name, tool);
        });
        const resolvedTools = [];
        for (const skill of extensionSkills) {
            console.log(`[DEBUG] skill ${skill.id} configuration:`, skill.configuration);
            let workingSkill = skill;
            let config = skill.configuration ? parseSkillConfig(skill) : {};
            if (!skill.configuration?.trim()) {
                try {
                    const detailResponse = await axios_1.default.get(`${gatewayUrl}/api/skills/${skill.id}`, {
                        headers: gatewaySkillReadHeaders(apiToken, userId),
                    });
                    workingSkill = detailResponse.data;
                    config = parseSkillConfig(workingSkill);
                }
                catch {
                }
            }
            const toolName = normalizeToolName(skill.name || `skill_${skill.id}`, skill.id);
            registerGatewayToolMetadata(toolName, workingSkill);
            let toolDescription = workingSkill.description || `Execute extended skill: ${workingSkill.name}`;
            if (workingSkill.requiresConfirmation) {
                toolDescription +=
                    " If this skill requires confirmation, approval happens via the chat UI buttons only; do not instruct the user to type \"confirm\" or to send JSON with confirmed:true.";
            }
            const zodSchema = buildSkillZodSchema(config, skill.schemaProperties);
            const structuredTool = new tools_1.DynamicStructuredTool({
                name: toolName,
                description: toolDescription,
                schema: zodSchema,
                func: async (args, _runManager, runConfig) => {
                    try {
                        let execInput = args;
                        let currentSkill = workingSkill;
                        let currentConfig = config;
                        try {
                            const detailResponse = await axios_1.default.get(`${gatewayUrl}/api/skills/${skill.id}`, {
                                headers: gatewaySkillReadHeaders(apiToken, userId),
                            });
                            currentSkill = detailResponse.data;
                            currentConfig = parseSkillConfig(currentSkill);
                        }
                        catch {
                        }
                        const executionMode = normalizeExecutionMode(currentSkill.executionMode);
                        if (executionMode === "OPENCLAW" || (currentConfig.kind || "").toLowerCase() === "openclaw") {
                            const openClawInput = typeof execInput === "string"
                                ? execInput
                                : execInput && typeof execInput === "object" && typeof execInput.input === "string"
                                    ? String(execInput.input)
                                    : JSON.stringify(execInput ?? {});
                            return await executeOpenClawSkill(options?.plannerModel, toolName, openClawInput, currentConfig, Array.from(toolLookup.values()));
                        }
                        const executeUrl = `${gatewayUrl}/api/skills/execute`;
                        const executeSessionId = options?.sessionId ?? runConfig?.configurable?.thread_id
                            ? String(options?.sessionId ?? runConfig?.configurable?.thread_id)
                            : undefined;
                        const executeHeaders = gatewaySkillMutationHeaders(apiToken, userId, executeSessionId);
                        const parameters = execInput && typeof execInput === "object" && !Array.isArray(execInput)
                            ? execInput
                            : {};
                        const executePayload = { skillId: currentSkill.id, parameters };
                        let executeResponse;
                        try {
                            executeResponse = await axios_1.default.post(executeUrl, executePayload, { headers: executeHeaders });
                        }
                        catch (apiError) {
                            return `Error executing extended skill "${skill.name}": ${formatToolError(apiError)}`;
                        }
                        const responseData = executeResponse.data;
                        if (responseData.status === "CONFIRMATION_REQUIRED") {
                            const toolCallId = runConfig?.configurable?.thread_id
                                ? `${String(runConfig.configurable.thread_id)}:${toolName}`
                                : `${toolName}:confirm`;
                            const resume = (0, langgraph_1.interrupt)({
                                kind: "extended_skill_confirmation",
                                toolName,
                                toolCallId,
                                skillName: String(responseData.skillName || currentSkill.name || toolName),
                                skillId: currentSkill.id,
                                summary: `Execute skill: ${responseData.skillName || currentSkill.name || toolName}`,
                                details: "",
                                parametersPreview: parameters,
                                gatewayRequestId: String(responseData.requestId || ""),
                            });
                            const result = resume;
                            if (!result.confirmed) {
                                return JSON.stringify({ status: "CANCELLED", message: "User cancelled the skill execution." });
                            }
                            const confirmedPayload = {
                                skillId: currentSkill.id,
                                parameters: parameters,
                                confirmed: true,
                                requestId: responseData.requestId,
                                ...(result.adjustedParams ? { adjustedParams: result.adjustedParams } : {}),
                            };
                            let confirmedResponse;
                            try {
                                confirmedResponse = await axios_1.default.post(executeUrl, confirmedPayload, { headers: executeHeaders });
                            }
                            catch (confirmedError) {
                                return `Error executing extended skill "${skill.name}" after confirmation: ${formatToolError(confirmedError)}`;
                            }
                            return typeof confirmedResponse.data === "string"
                                ? confirmedResponse.data
                                : JSON.stringify(confirmedResponse.data);
                        }
                        return typeof executeResponse.data === "string"
                            ? executeResponse.data
                            : JSON.stringify(executeResponse.data);
                    }
                    catch (error) {
                        if ((0, langgraph_1.isGraphInterrupt)(error))
                            throw error;
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
    }
    catch (error) {
        console.error("[agent-core] Failed to load extended skills from gateway:", formatToolError(error));
        return [];
    }
}
function buildConfirmedToolInputString(args) {
    return JSON.stringify(buildConfirmedToolArgs(args));
}
function buildConfirmedToolArgs(args) {
    if (args === undefined || args === null) {
        return { confirmed: true };
    }
    if (typeof args === "object" && !Array.isArray(args)) {
        return { ...args, confirmed: true };
    }
    if (typeof args === "string") {
        const trimmed = args.trim();
        if (!trimmed)
            return { confirmed: true };
        try {
            const o = JSON.parse(trimmed);
            if (o && typeof o === "object" && !Array.isArray(o)) {
                return { ...o, confirmed: true };
            }
        }
        catch {
            return { confirmed: true, input: trimmed };
        }
        return { confirmed: true, input: trimmed };
    }
    return { confirmed: true, input: String(args) };
}
async function invokeExtendedSkillWithConfirmed(gatewayUrl, apiToken, userId, toolName, toolArguments, options) {
    const extendedTools = await loadGatewayExtendedTools(gatewayUrl, apiToken, userId, {
        plannerModel: options.plannerModel,
        availableTools: options.availableTools,
    });
    const underscore = toolName.replace(/-/g, "_");
    const tool = extendedTools.find((t) => t.name === toolName)
        ?? extendedTools.find((t) => t.name === underscore);
    if (!tool) {
        return JSON.stringify({ error: `Extended skill tool not found: ${toolName}` });
    }
    const merged = buildConfirmedToolArgs(toolArguments);
    const raw = await tool.invoke(merged);
    return typeof raw === "string" ? raw : JSON.stringify(raw);
}
class JavaSkillGeneratorTool extends tools_1.DynamicStructuredTool {
    gatewayUrl;
    apiToken;
    userId;
    constructor(gatewayUrl, apiToken, userId) {
        super({
            name: "skill_generator",
            description: "Creates a NEW extension skill on SkillGateway—use ONLY after you have confirmed no existing tool (built-in, gateway extensions, or loadable filesystem skills) can fulfill the request, OR the user explicitly asked to add/create a new skill. " +
                "Provide targetType and the corresponding fields for that type (api, ssh, openclaw, or template) as structured tool arguments. " +
                "For API skills, headers, query, testInput, and parameterContract may be sent either as objects or as JSON strings; booleans may be true/false strings. " +
                "Generated POST/PUT/PATCH/DELETE API skills default `parameterBinding` to jsonBody so flat contract fields map to the JSON request body; use `formBody` in configuration for `application/x-www-form-urlencoded` POST APIs, and `query` for URL-only APIs. " +
                "After save, API and SSH extension skills are invoked with structured top-level parameters (not a single input envelope string). " +
                "On success, API-type skills return status VALIDATION_SKIPPED (no automatic HTTP probe); verify by invoking the new skill.",
            schema: skillGeneratorToolInputSchema,
            func: async (args) => {
                const params = args;
                const generated = buildGeneratedSkill(params);
                if (generated.missingFields.length > 0 || !generated.skillPayload || !generated.config) {
                    return JSON.stringify({
                        status: "INPUT_INCOMPLETE",
                        missingFields: generated.missingFields,
                        message: "Missing required skill fields. Provide the missing fields and try again.",
                    });
                }
                const saveResult = await saveGeneratedSkill(this.gatewayUrl, this.apiToken, generated.skillPayload, params.allowOverwrite ?? false, this.userId);
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
                let validation;
                if (params.targetType === "api" || !params.targetType) {
                    validation = {
                        success: true,
                        skipped: true,
                        message: "Automatic post-save API probe is disabled. Invoke the saved skill manually to verify connectivity and parameters.",
                    };
                }
                else {
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
        this.gatewayUrl = gatewayUrl;
        this.apiToken = apiToken;
        this.userId = userId;
    }
}
exports.JavaSkillGeneratorTool = JavaSkillGeneratorTool;
class JavaSshTool extends tools_1.DynamicStructuredTool {
    constructor(gatewayUrl, apiToken, userId, options) {
        const dispatch = options?.dispatch ?? "legacy";
        const baseUrl = gatewayUrl.replace(/\/+$/, "");
        super({
            name: "ssh_executor",
            description: "Executes a shell command on a remote server via SSH. " +
                "Provide host, username, command, and either privateKey or password as separate fields. " +
                "If an extension skill covers the same SSH capability, use that extension tool instead of this built-in. " +
                "Destructive commands are gated by the in-app confirmation UI; do not ask the user to type confirmation text.",
            schema: exports.sshExecutorToolInputSchema,
            func: async (args, _runManager, runConfig) => {
                try {
                    const headers = {
                        "X-Agent-Token": apiToken,
                        "Content-Type": "application/json",
                    };
                    if (userId) {
                        headers["X-User-Id"] = userId;
                    }
                    const dangerousPattern = /rm\s+-rf|mkfs|dd\s+if=|shutdown|reboot/;
                    if (!args.confirmed && dangerousPattern.test(args.command)) {
                        const tc = runConfig?.toolCall;
                        const toolCallId = (typeof tc?.id === "string" && tc.id.trim())
                            ? tc.id.trim()
                            : "ssh_executor:pending";
                        const resume = (0, langgraph_1.interrupt)({
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
                    const url = dispatch === "gateway"
                        ? `${baseUrl}/api/system-skills/execute`
                        : `${gatewayUrl}/api/skills/ssh`;
                    const body = dispatch === "gateway" ? { toolName: "ssh_executor", arguments: args } : args;
                    const response = await axios_1.default.post(url, body, { headers });
                    return response.data;
                }
                catch (error) {
                    if ((0, langgraph_1.isGraphInterrupt)(error))
                        throw error;
                    return `Error executing SSH command: ${formatToolError(error)}`;
                }
            },
        });
    }
}
exports.JavaSshTool = JavaSshTool;
class JavaComputeTool extends tools_1.DynamicStructuredTool {
    constructor(gatewayUrl, apiToken, options) {
        const dispatch = options?.dispatch ?? "legacy";
        const baseUrl = gatewayUrl.replace(/\/+$/, "");
        super({
            name: "compute",
            description: "Math and date operations via Skill Gateway. Supply operation and operands as separate fields (see parameter schema). "
                + "Gateway body is { operation, operands }—do not wrap them in an extra input string.",
            schema: exports.computeToolInputSchema,
            func: async (args) => {
                try {
                    const headers = {
                        "X-Agent-Token": apiToken,
                        "Content-Type": "application/json",
                    };
                    const payload = dispatch === "gateway"
                        ? { toolName: "compute", arguments: { operation: args.operation, operands: args.operands } }
                        : { operation: args.operation, operands: args.operands };
                    const url = dispatch === "gateway"
                        ? `${baseUrl}/api/system-skills/execute`
                        : `${gatewayUrl}/api/skills/compute`;
                    const response = await axios_1.default.post(url, payload, { headers });
                    return JSON.stringify(response.data);
                }
                catch (error) {
                    return `Error executing compute: ${formatToolError(error)}`;
                }
            },
        });
    }
}
exports.JavaComputeTool = JavaComputeTool;
class JavaLinuxScriptTool extends tools_1.DynamicStructuredTool {
    constructor(gatewayUrl, apiToken, userId) {
        super({
            name: "linux_script_executor",
            description: "Executes a shell command on a server using credentials stored in the user server ledger in Skill Gateway (host, user, password or key path). " +
                "Provide the ledger `id` from server_lookup and `command` (do NOT wrap in a JSON string under 'input'). " +
                "Requires a logged-in user context (X-User-Id) for the gateway.",
            schema: linuxScriptToolInputSchema,
            func: async (args) => {
                try {
                    if (!userId?.trim()) {
                        return JSON.stringify({ error: "linux_script_executor requires a logged-in user (X-User-Id)." });
                    }
                    const response = await axios_1.default.post(`${gatewayUrl}/api/skills/linux-script`, { id: args.id, command: args.command }, {
                        headers: {
                            "X-Agent-Token": apiToken,
                            "Content-Type": "application/json",
                            "X-User-Id": userId,
                        },
                    });
                    if (typeof response.data === "string") {
                        return response.data;
                    }
                    if (response.data && typeof response.data.result === "string") {
                        return response.data.result;
                    }
                    return JSON.stringify(response.data);
                }
                catch (error) {
                    return `Error executing linux script: ${formatToolError(error)}`;
                }
            },
        });
    }
}
exports.JavaLinuxScriptTool = JavaLinuxScriptTool;
class JavaServerLookupTool extends tools_1.DynamicStructuredTool {
    constructor(gatewayUrl, apiToken, userId) {
        super({
            name: "server_lookup",
            description: "Finds up to 5 server candidates (`id` + `name`) for a user-entered serverName (relevance-ordered; connection secrets stay in Gateway DB only, not returned). " +
                "If exactly one row, use its `id` for linux_script_executor next; if several, ask the user to pick an `id`. " +
                "Provide `serverName` (do NOT wrap in a single input string).",
            schema: serverLookupToolInputSchema,
            func: async (args) => {
                try {
                    const headers = {
                        "X-Agent-Token": apiToken,
                        "Content-Type": "application/json",
                    };
                    if (userId) {
                        headers["X-User-Id"] = userId;
                    }
                    const response = await axios_1.default.get(`${gatewayUrl}/api/skills/server-lookup`, {
                        headers,
                        params: { serverName: args.serverName },
                    });
                    return JSON.stringify(response.data);
                }
                catch (error) {
                    return `Error looking up server: ${formatToolError(error)}`;
                }
            },
        });
    }
}
exports.JavaServerLookupTool = JavaServerLookupTool;
const JAVA_API_TOOL_DESCRIPTION = "Calls an external API via the Java gateway. " +
    "Provide url, method, headers, and body as separate fields (do NOT wrap everything in a single JSON string under 'input'). " +
    "If an extension skill covers the same HTTP capability, use that extension tool instead of this built-in.";
class JavaApiTool extends tools_1.DynamicStructuredTool {
    constructor(gatewayUrl, apiToken, options) {
        const dispatch = options?.dispatch ?? "legacy";
        const baseUrl = gatewayUrl.replace(/\/+$/, "");
        super({
            name: "api_caller",
            description: JAVA_API_TOOL_DESCRIPTION,
            schema: exports.apiCallerToolInputSchema,
            func: async (args) => {
                try {
                    const headers = {
                        "X-Agent-Token": apiToken,
                        "Content-Type": "application/json",
                    };
                    const url = dispatch === "gateway"
                        ? `${baseUrl}/api/system-skills/execute`
                        : `${gatewayUrl}/api/skills/api`;
                    const body = dispatch === "gateway" ? { toolName: "api_caller", arguments: args } : args;
                    const response = await axios_1.default.post(url, body, { headers });
                    return JSON.stringify(response.data);
                }
                catch (error) {
                    return `Error calling API: ${formatToolError(error)}`;
                }
            },
        });
    }
}
exports.JavaApiTool = JavaApiTool;
//# sourceMappingURL=skill-shared.js.map