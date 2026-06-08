"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryParseJson = tryParseJson;
exports.invokeToolDirect = invokeToolDirect;
exports.summarizeToolResult = summarizeToolResult;
exports.resolveAllowedTools = resolveAllowedTools;
const tools_1 = require("@langchain/core/tools");
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
//# sourceMappingURL=openclaw-executor.js.map