import type { BindableAgentTool } from "./java-skills";
declare function tryParseJson(raw: string): unknown;
declare function invokeToolDirect(tool: BindableAgentTool, input: unknown): Promise<string>;
declare function summarizeToolResult(result: string): string | undefined;
declare function resolveAllowedTools(allowedTools: string[] | undefined, toolLookup: Map<string, BindableAgentTool>): BindableAgentTool[];
export { tryParseJson, invokeToolDirect, summarizeToolResult, resolveAllowedTools };
