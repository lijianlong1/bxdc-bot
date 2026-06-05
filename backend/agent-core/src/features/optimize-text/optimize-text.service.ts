import { ChatOpenAI } from "@langchain/openai";
import { composeOpenAiCompatibleFetch } from "../../utils/llm-request-role-normalize";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import axios from "axios";

const GATEWAY_URL = process.env.JAVA_GATEWAY_URL || "http://localhost:18080";
const GATEWAY_TOKEN = process.env.JAVA_GATEWAY_TOKEN || "your-secure-token-here";

const DEFAULT_PROMPTS: Record<string, { systemPrompt: string; userPromptTemplate: string }> = {
  description: {
    systemPrompt: "你是 Skill 配置助手，帮助用户优化技能介绍文本。输出严格 JSON：{\"optimizedText\":\"...\",\"explanation\":\"...\"}。",
    userPromptTemplate: "优化以下技能介绍，使其清晰描述功能、输入输出。如有缺失信息请补充。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  api_interface_description: {
    systemPrompt: "你是 API Skill 配置助手，帮助用户优化接口说明文本。输出严格 JSON：{\"optimizedText\":\"...\",\"explanation\":\"...\"}。",
    userPromptTemplate: "优化以下接口说明，结构化描述参数含义、枚举值、默认值、注意事项。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  api_parameter_contract: {
    systemPrompt: "你是 JSON Schema 专家。修正参数格式契约的 JSON 语法错误（补引号、补逗号、修正括号），自动补充字段的 description/type/enum。\n\n严格规则：\n1. 必须输出标准 JSON Schema 格式：{\"type\":\"object\",\"properties\":{...}}，每个属性含 type/description，可选 enum/enumSource/default\n2. enum 支持 string[] 或 [{label,value}]（带展示名的键值对）\n3. enumSource 字段只包含 url/method/headers/jsonPath/valueKey/labelKey/searchParam/refreshIntervalSec\n4. 如果当前输入是扁平格式（如 {\"env\":{\"type\":\"string\"}}），自动包裹为 {\"type\":\"object\",\"properties\":{...}}\n5. 只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}，optimizedText 必须是合法的 JSON 字符串",
    userPromptTemplate: "修正以下参数格式契约的语法，补全缺失字段，将扁平格式自动包裹为标准 JSON Schema 格式。enum 按场景换成 label/value 格式，需动态获取的枚举补 enumSource。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  api_async_poll: {
    systemPrompt: "你是 API Skill 配置助手。修正异步轮询配置 JSON 语法，补充缺失的关键字段。\n\n严格规则：\n1. 只输出以下字段：pollEndpoint、idJsonPath、pollMethod、pollIntervalSeconds、maxWaitSeconds、completionJsonPath、completionValue、failedValues、resultJsonPath、pollHeaders\n2. JSON Path 使用点分隔格式（如 status、data.task_id），严禁使用 $ 前缀\n3. 只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}，optimizedText 必须是合法的 JSON 字符串",
    userPromptTemplate: "修正以下异步轮询配置 JSON，补全缺失字段。注意 JSON Path 用点分隔，不要加 $ 前缀。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  api_headers: {
    systemPrompt: "你是 JSON 格式校验助手。只修正语法错误，不改变键值对含义。只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}，optimizedText 必须是合法的 JSON 字符串。",
    userPromptTemplate: "修正以下 Headers JSON 的语法错误。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  api_query: {
    systemPrompt: "你是 JSON 格式校验助手。修正语法错误。只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}，optimizedText 必须是合法的 JSON 字符串。",
    userPromptTemplate: "修正以下 Query JSON 的语法错误。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  api_body: {
    systemPrompt: "你是 JSON 格式校验助手。修正语法错误。只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}，optimizedText 必须是合法的 JSON 字符串。",
    userPromptTemplate: "修正以下 Body JSON 的语法错误。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  ssh_command: {
    systemPrompt: "你是 Shell 命令安全审查助手。检查命令语法和潜在安全风险，必要时优化。只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}。",
    userPromptTemplate: "检查并优化以下 Shell 命令，评估安全风险。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
  openclaw_prompt: {
    systemPrompt: "你是 OPENCLAW Skill 配置助手，帮助优化自主规划提示词。优化 Markdown 结构、补充任务分解指引。只返回严格 JSON 对象：{\"optimizedText\":\"...\",\"explanation\":\"...\"}。",
    userPromptTemplate: "优化以下自主规划提示词，使 Markdown 结构更清晰、任务分解更完整。\n\n当前文本：\n{{currentText}}\n{{context}}",
  },
};

export class OptimizeTextService {
  private llm: ChatOpenAI;

  constructor(apiKey: string, modelName: string = "gpt-4", baseUrl?: string) {
    this.llm = new ChatOpenAI({
      apiKey,
      modelName,
      configuration: {
        ...(baseUrl ? { baseURL: baseUrl.replace(/\/+$/, "") } : {}),
        fetch: composeOpenAiCompatibleFetch(),
        timeout: 110000,
      },
      temperature: 0.3,
    });
  }

  async optimize(fieldId: string, currentText: string, context?: string): Promise<{ optimizedText: string; explanation: string }> {
    try {
    const prompt = await this.fetchPrompt(fieldId);

    const userMessage = prompt.userPromptTemplate
      .replace("{{currentText}}", currentText)
      .replace("{{context}}", context ? `\n上下文：${context}` : "");

    console.log('[optimize-text] calling LLM...');
    const response = await this.llm.invoke([
      new SystemMessage(prompt.systemPrompt),
      new HumanMessage(userMessage),
    ]);
    console.log('[optimize-text] LLM response received');

    const raw = typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? (response.content[0] as any)?.text || ""
        : "";

    try {
      // 1) 去掉 markdown 代码块围栏（```json ... ``` / ``` ... ```），避免污染 JSON
      const stripped = raw
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "")
        .trim();

      // 2) 非贪婪匹配：找第一个完整的 { ... }，避免把 LLM 后续追加的文字也吃进去
      const jsonMatch = stripped.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }

      // 3) JSON 解析失败时打印原始内容（截断 500 字符）方便排查
      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (jsonErr) {
        console.error(
          '[optimize-text] JSON.parse failed. raw (first 500 chars):',
          raw.slice(0, 500),
          'matched (first 500 chars):',
          jsonMatch[0].slice(0, 500)
        );
        throw jsonErr;
      }

      if (typeof parsed.optimizedText !== "string" || typeof parsed.explanation !== "string") {
        throw new Error(
          `Missing required fields: optimizedText=${typeof parsed.optimizedText}, explanation=${typeof parsed.explanation}`
        );
      }
      return {
        optimizedText: parsed.optimizedText,
        explanation: parsed.explanation,
      };
    } catch (e) {
      console.error('[optimize-text] parse failed:', e instanceof Error ? e.message : String(e));
      return {
        optimizedText: currentText,
        explanation: "AI 优化失败：大模型返回格式异常，请重试。",
      };
    }
    } catch (e) {
      console.error('[optimize-text] LLM call failed:', e instanceof Error ? e.message : String(e));
      return {
        optimizedText: currentText,
        explanation: "AI 优化失败：" + (e instanceof Error ? e.message : "未知错误"),
      };
    }
  }

  private async fetchPrompt(fieldId: string): Promise<{ systemPrompt: string; userPromptTemplate: string }> {
    try {
      const response = await axios.get(`${GATEWAY_URL}/api/skills/text-prompts/${fieldId}`, {
        headers: {
          "X-Agent-Token": GATEWAY_TOKEN,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });
      return {
        systemPrompt: response.data.systemPrompt || "",
        userPromptTemplate: response.data.userPromptTemplate || "",
      };
    } catch {
      const fallback = DEFAULT_PROMPTS[fieldId];
      if (fallback) return fallback;
      return {
        systemPrompt: "你是文本优化助手。输出严格 JSON：{\"optimizedText\":\"...\",\"explanation\":\"...\"}。",
        userPromptTemplate: "优化以下文本。\n\n{{currentText}}\n{{context}}",
      };
    }
  }
}
