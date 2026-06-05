import { ChatOpenAI } from "@langchain/openai";
import { composeOpenAiCompatibleFetch } from "../../utils/llm-request-role-normalize";
import { GENERATE_AVATAR_SYSTEM_PROMPT, GENERATE_GREETING_SYSTEM_PROMPT } from "./prompts";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export class AvatarService {
  private llm: ChatOpenAI;
  private greetingCache: Map<string, { content: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

  constructor(apiKey: string, modelName: string = "gpt-4", baseUrl?: string) {
    this.llm = new ChatOpenAI({
      apiKey,
      modelName: modelName,
      configuration: {
        ...(baseUrl ? { baseURL: baseUrl.replace(/\/+$/, "") } : {}),
        fetch: composeOpenAiCompatibleFetch(),
      },
      temperature: 0.7, // Higher creativity for avatar/greeting
      timeout: 30000, // 30秒超时
    });
  }

  async generateAvatar(nickname: string): Promise<string> {
    try {
      const response = await this.llm.invoke([
        new SystemMessage(GENERATE_AVATAR_SYSTEM_PROMPT),
        new HumanMessage(`Nickname: ${nickname}`),
      ]);
      
      const content = typeof response.content === 'string' 
        ? response.content 
        : Array.isArray(response.content) 
          ? (response.content[0] as any).text // Fallback for complex content
          : '';
          
      // Clean up response to get just the emoji
      // This regex is a simple approximation for emojis, might need refinement but good enough for now
      // It keeps emoji characters and removes others.
      // If the LLM follows instructions, it should be just an emoji.
      const emoji = content.trim();
      return emoji || '👤'; // Fallback if empty
    } catch (error) {
      console.error("Error generating avatar:", error);
      return '👤'; // Fallback on error
    }
  }

  async generateGreeting(nickname: string, avatar: string): Promise<string> {
    const cacheKey = `${nickname}:${avatar}`;
    const cached = this.greetingCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      console.log(`[AvatarService] Returning cached greeting for ${nickname}`);
      return cached.content;
    }

    const start = Date.now();
    try {
      console.log(`[AvatarService] Generating greeting for ${nickname}...`);
      
      // 使用 Promise.race 给 LLM 调用设置一个软超时
      // 如果 3 秒内没返回，我们先返回一个默认欢迎语，但后台继续生成并缓存
      const defaultGreeting = `欢迎你，${nickname} ${avatar}！很高兴见到你。`;
      
      const responsePromise = this.llm.invoke([
        new SystemMessage(GENERATE_GREETING_SYSTEM_PROMPT),
        new HumanMessage(`User: ${nickname} (Avatar: ${avatar})`),
      ]);

      // 这里的超时只是为了让用户更早看到内容，实际 LLM 调用还会继续
      const response = await Promise.race([
        responsePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      ]);

      if (!response) {
        console.log(`[AvatarService] Greeting generation timed out (3s), returning default`);
        // 异步处理后续结果并存入缓存
        responsePromise.then(res => {
          const content = (typeof res.content === 'string'
            ? res.content
            : Array.isArray(res.content)
                ? (res.content[0] as any).text
                : '').trim();
          if (content) {
            this.greetingCache.set(cacheKey, { content, timestamp: Date.now() });
            console.log(`[AvatarService] Late greeting cached for ${nickname}`);
          }
        }).catch(err => console.warn("[AvatarService] Late generation error:", err instanceof Error ? err.message : err));
        
        return defaultGreeting;
      }

      const content = (typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
            ? (response.content[0] as any).text
            : '').trim();

      const duration = Date.now() - start;
      console.log(`[AvatarService] Greeting generated in ${duration}ms`);
      
      if (content) {
        this.greetingCache.set(cacheKey, { content, timestamp: Date.now() });
      }
      
      return content || defaultGreeting;
    } catch (error) {
      console.warn("[AvatarService] Greeting generation error (background):", error instanceof Error ? error.message : error);
      return `欢迎你，${nickname} ${avatar}！很高兴见到你。`; // Simple fallback
    }
  }
}
