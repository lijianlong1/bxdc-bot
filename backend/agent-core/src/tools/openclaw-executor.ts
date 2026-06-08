/**
 * OPENCLAW Skill 执行辅助模块
 *
 * 模块职责：
 * - 提供 OPENCLAW Skill 子规划执行所需的工具函数（工具调用、结果汇总等）
 * - 不包含 `executeOpenClawSkill` 主函数（该函数依赖 java-skills.ts 的工具注册表，保持在原文件）
 *
 * 架构说明：
 * - OPENCLAW Skill 通过 `executeOpenClawSkill`（java-skills.ts）进行子规划执行
 * - 本模块的工具函数由 `executeOpenClawSkill` 调用
 */

import { isStructuredTool } from "@langchain/core/tools";
import type { Tool, DynamicTool, StructuredTool } from "@langchain/core/tools";
import type { BindableAgentTool } from "./java-skills";

// ============================================================================
// OPENCLAW — 工具函数
// ============================================================================

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

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

export { tryParseJson, invokeToolDirect, summarizeToolResult, resolveAllowedTools };
