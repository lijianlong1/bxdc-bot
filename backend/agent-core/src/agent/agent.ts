/**
 * Agent 工厂模块
 * 
 * 模块职责：
 * 1. 创建和配置 LangGraph ReAct Agent 实例
 * 2. 集成 OpenAI LLM 模型
 * 3. 注入 Java Skill Gateway 提供的各类工具
 * 4. 管理 Agent 状态检查点（checkpoint）用于中断/恢复
 * 
 * 核心流程：
 * 1. 根据配置创建 ChatOpenAI 实例
 * 2. 收集所有可用工具（条件暴露的 SSH、计算、Linux 脚本、服务器查询等；**默认不挂载** built-in `api_caller`）
 * 3. 加载 Gateway 扩展工具（动态技能）
 * 4. 使用 createReactAgent 创建 ReAct 架构 Agent
 * 5. 配置共享的 MemorySaver 用于状态持久化
 * 
 * 工具说明：
 * - JavaSkillGeneratorTool（来自 skill-generator.ts）: 技能生成工具
 * - JavaComputeTool: 数学计算工具
 * - JavaServerLookupTool: 服务器信息查询工具
 * - GatewayExtendedTools: 从 Skill Gateway 动态加载的扩展技能（含 SSH Extension Skill）
 * - ManageTasksTool: 任务状态管理工具
 * 
 * 环境变量：
 * - AGENT_BUILTIN_SKILL_DISPATCH: 内置技能路由模式（legacy/gateway）
 * 
 * @module AgentFactory
 * @author Agent Core Team
 * @since 1.0.0
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type { ClientOptions } from "openai";
import { composeOpenAiCompatibleFetch } from "../utils/llm-request-role-normalize";
import {
  JavaComputeTool,
  JavaServerLookupTool,
  loadGatewayExtendedTools,
  getAgentBuiltinSkillDispatch,
  type BindableAgentTool,
} from "../tools/java-skills";
import { JavaSkillGeneratorTool } from "../tools/skill-generator";
import { ManageTasksTool } from "../tools/manage-tasks";
import { AgentAnnotation, preModelHook } from "./tasks-state";
import type { SkillManager } from "../skills/skill.manager";

/**
 * 共享的进程内检查点存储
 * 
 * 用途：支持 LangGraph 的中断/恢复机制
 * - 在技能确认流程中，Agent 可以被中断等待用户确认
 * - 用户确认后，从检查点恢复继续执行
 * - 使用 MemorySaver 实现内存级别的状态存储（单进程）
 * 
 * 相关设计：skill-confirmation-react-redesign
 */
const sharedAgentCheckpointer = new MemorySaver();

/**
 * Agent 工厂类
 * 
 * 职责：封装 Agent 创建逻辑，提供统一的 Agent 实例化接口
 * 
 * 设计模式：工厂模式（Factory Pattern）
 * - 将复杂的 Agent 创建逻辑封装在工厂方法中
 * - 调用方只需提供必要的配置参数，无需了解内部实现细节
 */
export class AgentFactory {
  /**
   * 创建一个配置好的 ReAct Agent
   *
   * @param gatewayUrl - Java Skill Gateway 的基础 URL，用于调用各类技能服务
   * @param apiToken - API 认证令牌，用于访问 Gateway 服务
   * @param openAiApiKey - OpenAI API Key，用于 LLM 调用
   * @param config - 可选配置项
   *   @param config.modelName - LLM 模型名称（默认：gpt-4）
   *   @param config.baseUrl - OpenAI 兼容服务的自定义基础 URL
   *   @param config.callbacks - LLM 回调处理器数组
   *   @param config.sessionId - 会话标识符
   * @param skillManager - 技能管理器实例，用于获取动态技能工具
   * @param userId - 用户标识符，用于用户特定的配置和权限控制
   * 
   * @returns 包含以下属性的对象：
   *   - agent: 创建好的 LangGraph Agent 实例
   *   - plannerModel: 使用的 LLM 模型实例
   *   - baseTools: 基础工具数组
   * 
   * @example
   * ```typescript
   * const { agent, plannerModel, baseTools } = await AgentFactory.createAgent(
   *   'http://localhost:18080',
   *   'token',
   *   'sk-xxx',
   *   { modelName: 'gpt-4', sessionId: 'sess-001' },
   *   skillManager,
   *   'user-001'
   * );
   * ```
   */
  static async createAgent(
    gatewayUrl: string,
    apiToken: string,
    openAiApiKey: string,
    config?: { modelName?: string, baseUrl?: string, callbacks?: any[], sessionId?: string },
    skillManager?: SkillManager,
    userId?: string
  ): Promise<{
    agent: ReturnType<typeof createReactAgent>;
    plannerModel: ChatOpenAI;
    baseTools: BindableAgentTool[];
  }> {
    // 构建 OpenAI 客户端配置
    const openAiConfiguration: ClientOptions = {};
    if (config?.baseUrl?.trim()) {
      openAiConfiguration.baseURL = config.baseUrl.replace(/\/+$/, "");
    }
    // 配置自定义 fetch，用于添加请求头（用户ID、会话ID）
    openAiConfiguration.fetch = composeOpenAiCompatibleFetch({
      userId,
      sessionId: config?.sessionId,
    });

    // 创建 LLM 模型实例
    // streaming 默认开启，启用流式输出实现打字机效果。
    // 内网环境若受 LangChain tiktoken 网络访问影响（导致每次响应卡 30s+），
    // 可通过 .env 设置 AGENT_STREAMING=false 关闭流式响应。
    const agentStreaming = String(process.env.AGENT_STREAMING ?? "true").toLowerCase() !== "false";
    const model = new ChatOpenAI({
      modelName: config?.modelName || "gpt-4", // 或使用 OneAPI 兼容模型
      // 注意：@langchain/openai v1 使用 apiKey 而非 openAIApiKey
      apiKey: openAiApiKey,
      ...(Object.keys(openAiConfiguration).length > 0
        ? { configuration: openAiConfiguration }
        : {}),
      temperature: 0, // 使用确定性输出，便于调试和复现
      callbacks: config?.callbacks,
      streaming: agentStreaming, // 流式输出开关
    });

    // 获取内置技能路由模式
    const builtinDispatch = getAgentBuiltinSkillDispatch();
    
    // 构建基础工具数组
    // SSH 操作统一通过 SSH Extension Skill（kind: "ssh"）执行，不再注册 ssh_executor / linux_script_executor
    const baseTools: BindableAgentTool[] = [
      new JavaSkillGeneratorTool(gatewayUrl, apiToken, userId),
      new JavaComputeTool(gatewayUrl, apiToken, { dispatch: builtinDispatch }),
      new JavaServerLookupTool(gatewayUrl, apiToken, userId),
    ];
    
    // 从 Gateway 加载扩展工具（动态技能）
    const gatewayExtendedTools = await loadGatewayExtendedTools(gatewayUrl, apiToken, userId, {
      plannerModel: model,
      availableTools: baseTools,
      sessionId: config?.sessionId,
    });
    
    // 合并所有工具
    const tools = [
      ...baseTools,
      ...gatewayExtendedTools,
      ...(skillManager?.getLangChainTools() || []),
      new ManageTasksTool(),
    ];

    // 创建 ReAct Agent
    const agent = createReactAgent({
      llm: model,
      tools,
      stateSchema: AgentAnnotation,
      preModelHook,
      checkpointer: sharedAgentCheckpointer,
    });
    return { agent, plannerModel: model, baseTools };
  }
}
