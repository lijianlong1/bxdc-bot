/**
 * 系统提示词主入口模块
 * 
 * @module PromptsIndex
 * @author Agent Core Team
 * @since 1.0.0
 */

import type { SystemPrompts, TasksStatusMap } from "./types";
import { EnglishPrompts } from "./en";
import { ChinesePrompts } from "./zh";

// 缓存变量
let cachedPrompts: SystemPrompts | null = null;
let cachedLang: string | null = null;

function loadPrompts(): SystemPrompts {
  const lang = (process.env.AGENT_PROMPTS_LANGUAGE || "en").trim().toLowerCase();

  if (cachedPrompts && cachedLang === lang) {
    return cachedPrompts;
  }

  cachedLang = lang;

  switch (lang) {
    case "zh":
      console.log(`[Prompts] Loaded Chinese system prompts (AGENT_PROMPTS_LANGUAGE=${lang})`);
      cachedPrompts = ChinesePrompts;
      return cachedPrompts;
    
    case "en":
      console.log(`[Prompts] Loaded English system prompts (AGENT_PROMPTS_LANGUAGE=${lang})`);
      cachedPrompts = EnglishPrompts;
      return cachedPrompts;
    
    default:
      console.warn(
        `[Prompts] Invalid AGENT_PROMPTS_LANGUAGE value: "${process.env.AGENT_PROMPTS_LANGUAGE}". ` +
        `Falling back to English. Valid values are: "zh" (Chinese), "en" (English).`
      );
      cachedPrompts = EnglishPrompts;
      return cachedPrompts;
  }
}

// 使用 Proxy 实现懒加载
export const Prompts = new Proxy({} as SystemPrompts, {
  get(target, prop: keyof SystemPrompts) {
    const prompts = loadPrompts();
    return prompts[prop];
  },
});

/**
 * 拼接 `runTask` 注入的静态 `system` 内容：角色与使命 + 四条策略（顺序与历史行为一致）。
 */
export function buildStaticSystemPrompt(): string {
  return (
    Prompts.agentRolePrompt
    + Prompts.skillGeneratorPolicy
    + Prompts.extendedSkillRoutingPolicy
    + Prompts.taskTrackingPolicy
    + Prompts.confirmationUIPolicy
  );
}

export type { SystemPrompts, TasksStatusMap, TaskState, TaskStatusValue } from "./types";
