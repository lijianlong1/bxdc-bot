/**
 * Agent 控制器模块
 * 
 * 模块职责：
 * 1. 暴露 HTTP RESTful API 端点供外部调用 Agent 服务
 * 2. 实现 SSE（Server-Sent Events）流式响应，实时返回 Agent 执行过程
 * 3. 处理技能确认流程（中断/恢复），支持用户在 UI 上确认敏感操作
 * 4. 管理长期记忆（Memory）的检索和更新
 * 5. 跟踪工具调用状态并发送 trace 事件到前端
 * 
 * 核心端点：
 * - POST /agent/run: 启动 Agent 任务，返回 SSE 流
 * - POST /agent/confirm: 确认技能执行，恢复中断的 Agent
 * 
 * 架构设计：
 * - 使用 NestJS 装饰器定义路由和请求处理
 * - 使用 RxJS Subject 实现 SSE 流式响应
 * - 使用 LangGraph 的 interrupt/Command 机制实现确认流程
 * - 内存级别的确认状态管理（pendingConfirmations Map）
 * 
 * 确认流程说明：
 * 1. Agent 执行到需要确认的技能时触发 interrupt
 * 2. 控制器提取中断信息，通过 SSE 发送 confirmation_request 事件
 * 3. 前端展示确认对话框，用户点击确认/取消
 * 4. 前端调用 POST /agent/confirm 提交确认结果
 * 5. 控制器恢复（resolve）对应的 Promise，Agent 继续执行
 * 6. 用户取消时，发送 Command({ resume: { confirmed: false } })，Agent 优雅终止
 * 
 * 环境变量：
 * - JAVA_GATEWAY_URL: Java Skill Gateway 地址（默认：http://localhost:18080）
 * - JAVA_GATEWAY_TOKEN: Gateway 认证令牌
 * - LLM 相关配置通过 context.llm 传递
 * 
 * 策略提示词（Policy Prompts）：
 * - AGENT_SKILL_GENERATOR_POLICY: 技能生成策略
 * - AGENT_TASK_TRACKING_POLICY: 任务跟踪策略
 * - AGENT_CONFIRMATION_UI_POLICY: 确认 UI 策略
 * - AGENT_EXTENDED_SKILL_ROUTING_POLICY: 扩展技能路由策略
 * 
 * @module AgentController
 * @author Agent Core Team
 * @since 1.0.0
 */

import { Controller, Post, Body, Sse, MessageEvent, HttpCode, NotFoundException } from '@nestjs/common';
import { Observable, Subject, defer, concatAll } from 'rxjs';
import { AgentFactory } from '../agent/agent';
import { MemoryService } from '../mem/memory.service';
import { SkillManager } from '../skills/skill.manager';
import { LoggerService } from '../utils/logger.service';
import { describeGatewayExtendedTool } from '../tools/java-skills';
import {
  clearActiveParentToolId,
  runWithToolTraceContext,
  sanitizeToolTraceArguments,
  sanitizeToolResultForTrace,
  setActiveParentToolId,
  type ToolTraceEvent,
} from '../tools/tool-trace-context';
import { pickMergedLlm } from '../utils/llm-merge';
import { logAgentRunRawIfEnabled } from '../utils/agent-run-raw-log';
import { sanitizeHistoryForAgent } from '../utils/history-sanitize';
import { Command, INTERRUPT } from '@langchain/langgraph';
import { buildStaticSystemPrompt, Prompts } from '../prompts';
import { ConversationLogger } from '../utils/conversation-logger';

/** Payload from {@link interrupt} in extended skills / SSH tools (see java-skills). */
type SkillInterruptPayload = {
  kind: 'extended_skill_confirmation' | 'ssh_confirmation';
  toolName: string;
  toolCallId: string;
  skillName: string;
  summary: string;
  details?: string;
  skillId?: number;
  /** When trace args are not yet in lastToolArguments, tool layer fills this for the confirmation card. */
  parametersPreview?: unknown;
};

function unwrapLangGraphStreamPayload(raw: unknown): any {
  if (Array.isArray(raw) && raw.length >= 2 && typeof raw[0] === 'string') {
    return raw[1];
  }
  return raw;
}

function extractInterruptEntries(payload: unknown): Array<{ value?: unknown }> {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const arr = p[INTERRUPT] ?? p.__interrupt__;
  return Array.isArray(arr) ? arr : [];
}

/** Drop interrupt-only updates so SSE does not expose internal channel data to the client. */
function stripInterruptForClient(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const p = payload as Record<string, unknown>;
  if (!(INTERRUPT in p) && !('__interrupt__' in p)) return payload;
  const next = { ...p };
  delete next[INTERRUPT];
  delete next.__interrupt__;
  return Object.keys(next).length > 0 ? next : null;
}

/* ── Skill confirmation: suspend / resume ── */

const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000;

interface PendingConfirmation {
  resolve: (result: { confirmed: boolean; adjustedParams?: Record<string, unknown> }) => void;
  toolCallId: string;
  toolName: string;
  skillName: string;
  arguments?: unknown;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * In-memory map keyed by `${sessionId}:${toolCallId}`.
 * Single-process assumption (see design.md Decision 2).
 */
const pendingConfirmations = new Map<string, PendingConfirmation>();

function confirmationKey(sessionId: string, toolCallId: string): string {
  return `${sessionId}:${toolCallId}`;
}

type ToolStatus = 'running' | 'completed' | 'failed';

interface ExtractedToolCall {
  toolId: string;
  toolName: string;
  status: ToolStatus;
  arguments?: unknown;
  /** Present when status is completed/failed: tool output (sanitized). */
  result?: string;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getChunkMessages(chunk: any): any[] {
  if (!chunk || typeof chunk !== 'object') return [];

  return [
    ...asArray(chunk.agent?.messages),
    ...asArray(chunk.tools?.messages),
    ...asArray(chunk.messages),
  ];
}

function inferMessageKind(message: any): string {
  const nestedType = message?.kwargs?.type;
  if (typeof nestedType === 'string') return nestedType.toLowerCase();

  const explicitType = message?.type;
  if (typeof explicitType === 'string') return explicitType.toLowerCase();

  const nestedRole = message?.kwargs?.role;
  if (typeof nestedRole === 'string') return nestedRole.toLowerCase();

  const role = message?.role;
  if (typeof role === 'string') return role.toLowerCase();

  const id = message?.id;
  if (typeof id === 'string') return id.toLowerCase();
  if (Array.isArray(id)) return id.join('.').toLowerCase();

  // Fallback: if it looks like a chunk with content
  if (message?.content !== undefined) return 'aimessagechunk';

  return '';
}

function isAssistantMessage(message: any): boolean {
  const kind = inferMessageKind(message);
  return kind.includes('assistant') || kind.includes('aimessage') || kind === 'ai';
}

function isToolMessage(message: any): boolean {
  const kind = inferMessageKind(message);
  return kind.includes('toolmessage') || kind === 'tool';
}

function extractContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof (part as any).text === 'string') {
          return (part as any).text;
        }
        return '';
      })
      .join('');
    return text || null;
  }
  return null;
}

function getMessageContent(message: any): string | null {
  return extractContent(message?.kwargs?.content)
    ?? extractContent(message?.lc_kwargs?.content)
    ?? extractContent(message?.content)
    ?? null;
}

function getToolCallEntries(message: any): any[] {
  return [
    ...asArray(message?.tool_calls),
    ...asArray(message?.kwargs?.tool_calls),
    ...asArray(message?.kwargs?.additional_kwargs?.tool_calls),
    ...asArray(message?.additional_kwargs?.tool_calls),
  ];
}

function normalizeToolName(toolCall: any, fallback?: string): string | null {
  const name = toolCall?.name
    ?? toolCall?.function?.name
    ?? toolCall?.kwargs?.name
    ?? fallback;

  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function normalizeToolId(toolCall: any, fallback: string): string {
  const id = toolCall?.id ?? toolCall?.tool_call_id ?? toolCall?.function?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : fallback;
}

/** Prefer OpenAI tool_call_id on ToolMessage so completed events match started tool_calls. */
function normalizeToolIdFromToolMessage(message: any, messageIndex: number, toolName: string): string {
  const id =
    message?.tool_call_id
    ?? message?.kwargs?.tool_call_id
    ?? message?.lc_kwargs?.tool_call_id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  return `${toolName}:toolmsg:${messageIndex}`;
}

function parseToolArguments(rawArguments: unknown): unknown {
  if (typeof rawArguments !== 'string') return rawArguments;
  const trimmed = rawArguments.trim();
  if (!trimmed) return trimmed;

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function extractToolArguments(toolCall: any): unknown {
  return parseToolArguments(
    toolCall?.args
    ?? toolCall?.arguments
    ?? toolCall?.function?.arguments
    ?? toolCall?.kwargs?.args
    ?? toolCall?.kwargs?.arguments,
  );
}

function normalizeToolStatus(message: any): ToolStatus {
  const status = message?.status ?? message?.kwargs?.status;
  if (status === 'error' || status === 'failed') return 'failed';

  const content = getMessageContent(message)?.toLowerCase() ?? '';
  if (content.startsWith('error')) return 'failed';

  return 'completed';
}

function extractStartedToolCalls(message: any, messageIndex: number): ExtractedToolCall[] {
  if (!isAssistantMessage(message)) return [];

  return getToolCallEntries(message)
    .map((toolCall, index) => {
      const toolName = normalizeToolName(toolCall);
      if (!toolName) return null;

      return {
        // Keep fallback id aligned with frontend `extractToolInvocationsFromChunk`
        // so tool_status can upsert and replace initial generic displayName.
        toolId: normalizeToolId(toolCall, `${toolName}:${messageIndex}:${index}`),
        toolName,
        status: 'running' as const,
        arguments: sanitizeToolTraceArguments(extractToolArguments(toolCall)),
      };
    })
    .filter(Boolean) as ExtractedToolCall[];
}

function extractCompletedToolCall(message: any, messageIndex: number): ExtractedToolCall | null {
  if (!isToolMessage(message)) return null;

  const toolName = normalizeToolName(message, message?.kwargs?.name);
  if (!toolName) return null;

  const toolId = normalizeToolIdFromToolMessage(message, messageIndex, toolName);
  const status = normalizeToolStatus(message);
  const content = getMessageContent(message);
  const result =
    content != null && String(content).length > 0
      ? sanitizeToolResultForTrace(String(content))
      : undefined;

  return {
    toolId,
    toolName,
    status,
    result,
  };
}

function toolMessageContentIsCancelledSkill(content: string | null): boolean {
  if (!content) return false;
  const t = content.trim();
  if (!t.includes('CANCELLED')) return false;
  try {
    const j = JSON.parse(t) as { status?: string };
    return j?.status === 'CANCELLED';
  } catch {
    return false;
  }
}

/** True when a tool message for `toolCallId` has JSON `{ status: "CANCELLED" }` (user declined in UI). */
function chunkContainsCancelledToolForId(chunks: unknown[], toolCallId: string): boolean {
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') continue;
    const messages = getChunkMessages(chunk);
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!isToolMessage(msg)) continue;
      const toolName = normalizeToolName(msg, msg?.kwargs?.name) ?? 'unknown';
      const tid = normalizeToolIdFromToolMessage(msg, i, toolName);
      if (tid !== toolCallId) continue;
      if (toolMessageContentIsCancelledSkill(getMessageContent(msg))) return true;
    }
  }
  return false;
}

/**
 * Agent 控制器。
 * <p>
 * 暴露 HTTP 端点以接收任务请求，并通过 SSE 流式返回 Agent 的执行过程。
 * </p>
 */
@Controller('agent')
export class AgentController {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly skillManager: SkillManager,
    private readonly logger: LoggerService,
  ) {}

  private emitToolEvents(
    subject: Subject<MessageEvent>,
    chunk: any,
    seenToolStatuses: Map<string, ToolStatus>,
    lastToolArguments: Map<string, unknown>,
    lastEmittedToolResult: Map<string, string | undefined>,
    toolCallStartTimes: Map<string, number>,
    conversationLogger: ConversationLogger,
    traceId: string,
    sessionId: string,
    userId?: string,
  ) {
    const chunkMessages = getChunkMessages(chunk);
    for (let messageIndex = 0; messageIndex < chunkMessages.length; messageIndex += 1) {
      const message = chunkMessages[messageIndex];
      const startedCalls = extractStartedToolCalls(message, messageIndex);
      for (const startedCall of startedCalls) {
        this.emitToolEvent(
          subject,
          startedCall,
          seenToolStatuses,
          lastToolArguments,
          lastEmittedToolResult,
          toolCallStartTimes,
          conversationLogger,
          traceId,
          sessionId,
          userId,
        );
      }

      const completedCall = extractCompletedToolCall(message, messageIndex);
      if (completedCall) {
        this.emitToolEvent(
          subject,
          completedCall,
          seenToolStatuses,
          lastToolArguments,
          lastEmittedToolResult,
          toolCallStartTimes,
          conversationLogger,
          traceId,
          sessionId,
          userId,
        );
      }
    }
  }

  private emitToolEvent(
    subject: Subject<MessageEvent>,
    toolCall: ExtractedToolCall,
    seenToolStatuses: Map<string, ToolStatus>,
    lastToolArguments: Map<string, unknown>,
    lastEmittedToolResult: Map<string, string | undefined>,
    toolCallStartTimes: Map<string, number>,
    conversationLogger: ConversationLogger,
    traceId: string,
    sessionId: string,
    userId?: string,
  ) {
    const previousStatus = seenToolStatuses.get(toolCall.toolId);
    const prevEmittedResult = lastEmittedToolResult.get(toolCall.toolId);

    if (previousStatus === toolCall.status) {
      const canReemitCompletedWithResult =
        toolCall.status === 'completed'
        && toolCall.result !== undefined
        && toolCall.result !== prevEmittedResult;
      if (!canReemitCompletedWithResult) {
        return;
      }
    }

    seenToolStatuses.set(toolCall.toolId, toolCall.status);
    if (toolCall.result !== undefined) {
      lastEmittedToolResult.set(toolCall.toolId, toolCall.result);
    }
    const resolvedArguments =
      toolCall.arguments !== undefined
        ? toolCall.arguments
        : lastToolArguments.get(toolCall.toolId);

    if (toolCall.arguments !== undefined) {
      lastToolArguments.set(toolCall.toolId, toolCall.arguments);
    }

    const gatewayToolInfo = describeGatewayExtendedTool(toolCall.toolName);
    const toolInfo = gatewayToolInfo ?? this.skillManager.describeTool(toolCall.toolName);
    const event: ToolTraceEvent = {
      type: 'tool_status',
      toolId: toolCall.toolId,
      toolName: toolCall.toolName,
      displayName: toolInfo.displayName,
      kind: toolInfo.kind,
      status: toolCall.status,
      arguments: sanitizeToolTraceArguments(resolvedArguments),
      ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
      executionMode: gatewayToolInfo?.executionMode,
      executionLabel: gatewayToolInfo?.executionLabel,
    };

    if (toolCall.status === 'running') {
      setActiveParentToolId(toolCall.toolName, toolCall.toolId);
      toolCallStartTimes.set(toolCall.toolId, Date.now());
      console.log(`[ToolCallLog] Tool started: ${toolCall.toolName}, toolId: ${toolCall.toolId}, sessionId: ${sessionId}`);
    } else {
      clearActiveParentToolId(toolCall.toolName, toolCall.toolId);
      
      const startTime = toolCallStartTimes.get(toolCall.toolId);
      if (startTime) {
        const durationMs = Date.now() - startTime;
        const skillName = toolCall.toolName?.replace(/^extended_/, '') || toolCall.toolName;
        
        console.log(`[ToolCallLog] Tool completed: ${toolCall.toolName}, toolId: ${toolCall.toolId}, status: ${toolCall.status}, duration: ${durationMs}ms`);
        
        conversationLogger.logToolCall({
          traceId,
          sessionId,
          userId,
          toolName: toolCall.toolName,
          skillName,
          toolCallId: toolCall.toolId,
          requestParams: typeof resolvedArguments === 'object' ? JSON.stringify(resolvedArguments) : undefined,
          responseResult: typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result),
          status: toolCall.status,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          durationMs,
        }).then(() => {
          console.log(`[ToolCallLog] Successfully logged tool call to database: ${toolCall.toolName}`);
        }).catch((error) => {
          console.error(`[ToolCallLog] Failed to log tool call: ${error}`);
        });
      } else {
        console.log(`[ToolCallLog] No start time found for tool: ${toolCall.toolName}, toolId: ${toolCall.toolId}`);
      }
    }

    subject.next({ data: JSON.stringify(event) });
  }

  /* ── POST /agent/confirm ── */

  @Post('confirm')
  @HttpCode(200)
  confirmAction(@Body() body: { sessionId: string; toolCallId: string; confirmed: boolean; adjustedParams?: Record<string, unknown> }) {
    const key = confirmationKey(body.sessionId, body.toolCallId);
    const pending = pendingConfirmations.get(key);
    if (!pending) {
      throw new NotFoundException('No pending confirmation found for this sessionId/toolCallId');
    }
    clearTimeout(pending.timer);
    pendingConfirmations.delete(key);
    pending.resolve({ confirmed: body.confirmed, adjustedParams: body.adjustedParams });
    return { ok: true };
  }

  /**
   * 运行 Agent 任务。
   * <p>
   * 接收包含指令和上下文的 POST 请求，启动 Agent，并将结果作为 SSE 事件流返回。
   * </p>
   *
   * @param body 请求体，包含 `instruction` (指令), `context` (上下文) 和 `history` (历史对话)
   * @returns Observable<MessageEvent> SSE 事件流
   */
  @Post('run')
  @Sse()
  runTask(@Body() body: { instruction: string; context: any; history?: any[] }): Observable<MessageEvent> {
    const { instruction, context, history } = body;
    const safeHistory = Array.isArray(history) ? history : [];
    const sanitizedHistory = sanitizeHistoryForAgent(safeHistory as Array<{ role?: string; content?: unknown }>);
    console.log('[DEBUG] Sanitized history roles:', sanitizedHistory.map(m => m?.role));
    
    const userId = context?.userId;
    const sessionId = context?.sessionId || 'default-session';

    logAgentRunRawIfEnabled(body, { sessionId, userId });

    const subject = new Subject<MessageEvent>();

    // In a real app, these would come from config/env
    const gatewayUrl = process.env.JAVA_GATEWAY_URL || 'http://localhost:18080';
    const apiToken = process.env.JAVA_GATEWAY_TOKEN || 'your-secure-token-here';

    // Fetch LLM settings from skill-gateway if userId is provided
    let llmContext = context || {};
    if (userId) {
      fetch(`${gatewayUrl}/api/user/${userId}/llm-config-internal`)
        .then((llmConfigResponse) => {
          if (llmConfigResponse.ok) {
            return llmConfigResponse.json();
          } else {
            console.warn('[agent] Failed to fetch LLM config:', llmConfigResponse.status);
            return null;
          }
        })
        .then((llmConfig) => {
          if (llmConfig) {
            console.log('[agent] Fetched LLM config from skill-gateway:', {
              llmApiBase: llmConfig.llmApiBase,
              llmModelName: llmConfig.llmModelName,
              hasApiKey: !!llmConfig.llmApiKey,
            });
            llmContext = {
              ...llmContext,
              llmApiBase: llmConfig.llmApiBase,
              llmModelName: llmConfig.llmModelName,
              llmApiKey: llmConfig.llmApiKey,
            };
          }
          this.executeAgentTask(instruction, llmContext, sanitizedHistory, userId, sessionId, subject, gatewayUrl, apiToken);
        })
        .catch((e) => {
          console.error('[agent] Error fetching LLM config:', e);
          this.executeAgentTask(instruction, llmContext, sanitizedHistory, userId, sessionId, subject, gatewayUrl, apiToken);
        });
    } else {
      this.executeAgentTask(instruction, llmContext, sanitizedHistory, userId, sessionId, subject, gatewayUrl, apiToken);
    }

    return subject.asObservable();
  }
  private async executeAgentTask(
    instruction: string,
    llmContext: any,
    sanitizedHistory: Array<{ role?: string; content?: unknown }>,
    userId: string | undefined,
    sessionId: string,
    subject: Subject<MessageEvent>,
    gatewayUrl: string,
    apiToken: string,
  ) {
    const llm = pickMergedLlm(llmContext);
    const openAiApiKey = llm.apiKey;
    const modelName = llm.modelName;
    const baseUrl = llm.baseUrl;

    const skillContext = this.skillManager.buildSkillPromptContext();

    const conversationLogger = new ConversationLogger();
    const startTime = Date.now();
    let llmRounds = 0;
    let toolCallRounds = 0;
    let isExceedMaxRound = 0;
    let isSuccess = 1;
    let errorMessage: string | undefined;
    let status = 'RUNNING';
    let finishReason: string | undefined;
    const traceId = `${sessionId}-${Date.now()}`;
    const toolNames: string[] = [];
    const skillNames: string[] = [];

    runWithToolTraceContext(
      (event) => subject.next({ data: JSON.stringify(event) }),
      async () => {
        let fullAssistantResponse = '';
        const seenToolStatuses = new Map<string, ToolStatus>();
        const lastToolArguments = new Map<string, unknown>();
        const lastEmittedToolResult = new Map<string, string | undefined>();
        const toolCallStartTimes = new Map<string, number>();
        try {
          const llmCallbackHandler = this.logger.createLlmCallbackHandler(sessionId, (event) => {
            subject.next({ data: JSON.stringify(event) });
          });
          const { agent } = await AgentFactory.createAgent(
            gatewayUrl,
            apiToken,
            openAiApiKey,
            { modelName, baseUrl, callbacks: [llmCallbackHandler], sessionId },
            this.skillManager,
            userId,
          );

          const memories = await this.memoryService.searchMemories(instruction, userId, 10);
          console.log(`[Memory] Retrieved ${memories.length} memories for user ${userId}`);
          if (memories.length > 0) {
            console.log(`[Memory] First memory: ${memories[0]}`);
          }

          const memoryContext = memories.length > 0
            ? `[User Profile & Preferences]\n${memories.map(m => `- ${m}`).join('\n')}\n\nWhen the user asks about their profile or family (e.g. 籍贯、家乡、喜好、昵称、我儿子叫啥、我女儿叫什么、我爱人叫什么), you MUST answer using the relevant information above and state it explicitly (e.g. "你儿子叫yoyo" when they ask 我儿子叫啥). Do not proactively list all facts unless asked.\n\n`
            : '';

          const staticSystemPrompt = buildStaticSystemPrompt();
          const profileDetails = await this.memoryService.fetchUserProfile(userId);
          const systemContent = profileDetails
            ? `${staticSystemPrompt}[个人特征信息]${profileDetails}`
            : staticSystemPrompt;
  
          const allowedHistoryRoles = new Set(['user', 'assistant']);
          const validHistory = sanitizedHistory
            .map((m) => {
              const role = m?.role;
              if (typeof role !== 'string') return null;
              const lr = role.toLowerCase();
              if (!allowedHistoryRoles.has(lr)) return null;
              return { ...m, role: lr };
            })
            .filter((m): m is NonNullable<typeof m> => m != null);

          const userTurnContentWithSystem = `System:\n${systemContent}\n\n${skillContext}${memoryContext}User Instruction:\n${instruction}`;

          const messages = [
            ...validHistory,
            { role: 'user' as const, content: userTurnContentWithSystem },
          ];

          console.log('[DEBUG] Final messages roles:', messages.map(m => m.role));
          console.log('[DEBUG] Final messages count:', messages.length);

          const graphConfig = { configurable: { thread_id: sessionId } };
          let stream: AsyncIterable<any> = await agent.stream({ messages }, graphConfig);
          let iterator = (stream as AsyncIterable<any>)[Symbol.asyncIterator]();

          outer: while (true) {
            const { value: raw, done } = await iterator.next();
            if (done) break;

            const payload = unwrapLangGraphStreamPayload(raw);
            const interruptEntries = extractInterruptEntries(payload);
            for (const entry of interruptEntries) {
              const v = entry.value as SkillInterruptPayload | undefined;
              if (
                v
                && (v.kind === 'extended_skill_confirmation' || v.kind === 'ssh_confirmation')
              ) {
                const gatewayInfo =
                  v.kind === 'extended_skill_confirmation'
                    ? describeGatewayExtendedTool(v.toolName)
                    : null;
                const skillName =
                  v.kind === 'extended_skill_confirmation'
                    ? (gatewayInfo?.displayName ?? v.toolName.replace(/^extended_/, ''))
                    : v.skillName;

                const resolvedArgs =
                  lastToolArguments.get(v.toolCallId) ?? v.parametersPreview;

                subject.next({
                  data: JSON.stringify({
                    type: 'confirmation_request',
                    sessionId,
                    toolCallId: v.toolCallId,
                    toolName: v.toolName,
                    skillName,
                    summary: v.summary ?? `Execute skill: ${skillName}`,
                    details: v.details ?? '',
                    arguments: resolvedArgs,
                  }),
                });

                const confirmedResult = await new Promise<{ confirmed: boolean; adjustedParams?: Record<string, unknown> }>((resolve) => {
                  const key = confirmationKey(sessionId, v.toolCallId);
                  const timer = setTimeout(() => {
                    pendingConfirmations.delete(key);
                    console.log(`[Confirmation] Timeout for ${key}, auto-cancelling`);
                    resolve({ confirmed: false });
                  }, CONFIRMATION_TIMEOUT_MS);
                  pendingConfirmations.set(key, {
                    resolve,
                    toolCallId: v.toolCallId,
                    toolName: v.toolName,
                    skillName,
                    arguments: resolvedArgs,
                    timer,
                  });
                });

                if (!confirmedResult.confirmed) {
                  const ac = new AbortController();
                  const cancelResumeStream = await agent.stream(
                    new Command({ resume: { confirmed: false } }),
                    { configurable: { thread_id: sessionId }, signal: ac.signal },
                  );
                  let cancelIter = cancelResumeStream[Symbol.asyncIterator]();
                  const MAX_CANCEL_CHUNKS = 24;
                  for (let step = 0; step < MAX_CANCEL_CHUNKS; step += 1) {
                    let raw: any;
                    try {
                      const n = await cancelIter.next();
                      if (n.done) break;
                      raw = n.value;
                    } catch (e) {
                      const name = e && typeof e === 'object' && 'name' in e ? (e as Error).name : '';
                      if (name === 'AbortError' || ac.signal.aborted) break;
                      throw e;
                    }
                    const payload = unwrapLangGraphStreamPayload(raw);
                    const forward = stripInterruptForClient(payload);
                    if (forward != null) {
                      subject.next({ data: JSON.stringify(forward) });
                      this.emitToolEvents(subject, forward, seenToolStatuses, lastToolArguments, lastEmittedToolResult, toolCallStartTimes, conversationLogger, traceId, sessionId, userId);
                      if (typeof forward === 'object') {
                        const lastAssistantMessage = getChunkMessages(forward)
                          .filter((message) => isAssistantMessage(message))
                          .at(-1);
                        const nextContent = getMessageContent(lastAssistantMessage);
                        if (nextContent) {
                          fullAssistantResponse = nextContent;
                          subject.next({ data: JSON.stringify({ role: 'assistant', content: nextContent }) });
                        }
                      }
                    }
                    if (chunkContainsCancelledToolForId([payload, forward].filter(Boolean), v.toolCallId)) {
                      ac.abort();
                      break;
                    }
                  }
                  if (!ac.signal.aborted) {
                    ac.abort();
                  }
                  fullAssistantResponse = `已取消执行「${skillName}」。`;
                  subject.next({ data: JSON.stringify({ role: 'assistant', content: fullAssistantResponse }) });
                  break outer;
                }

                const resumeStream = await agent.stream(
                  new Command({ resume: { confirmed: true, adjustedParams: confirmedResult.adjustedParams } }),
                  graphConfig,
                );
                iterator = resumeStream[Symbol.asyncIterator]();
                continue outer;
              }
            }

            const forward = stripInterruptForClient(payload);
            if (forward != null) {
              subject.next({ data: JSON.stringify(forward) });
              this.emitToolEvents(subject, forward, seenToolStatuses, lastToolArguments, lastEmittedToolResult, toolCallStartTimes, conversationLogger, traceId, sessionId, userId);

              if (typeof forward === 'object') {
                const messages = getChunkMessages(forward);
                for (const msg of messages) {
                  if (isAssistantMessage(msg)) {
                    const toolCalls = getToolCallEntries(msg);
                    for (const toolCall of toolCalls) {
                      const toolName = normalizeToolName(toolCall);
                      if (toolName && !toolNames.includes(toolName)) {
                        toolNames.push(toolName);
                        toolCallRounds++;
                      }
                      const skillName = toolName?.replace(/^extended_/, '') || toolName;
                      if (skillName && !skillNames.includes(skillName)) {
                        skillNames.push(skillName);
                      }
                    }
                  }
                }
              }

              if (typeof forward === 'object') {
                const forwardObj = forward as Record<string, unknown>;
                let nextContent: string | null = null;

                if (typeof forwardObj.content === 'string') {
                  nextContent = forwardObj.content;
                }

                if (!nextContent) {
                  const lastAssistantMessage = getChunkMessages(forward)
                    .filter((message) => isAssistantMessage(message))
                    .at(-1);
                  nextContent = getMessageContent(lastAssistantMessage);
                }

                if (nextContent && nextContent.length > 0) {
                  const newContent = fullAssistantResponse.length > 0 && nextContent.startsWith(fullAssistantResponse)
                    ? nextContent.slice(fullAssistantResponse.length)
                    : nextContent;

                  if (newContent.length > 0) {
                    fullAssistantResponse = nextContent;
                    subject.next({ data: JSON.stringify({ role: 'assistant', content: newContent }) });
                  }
                }
              }
            }
          }

          subject.complete();

          const safeAssistantResponse = (fullAssistantResponse && typeof fullAssistantResponse === 'string') ? fullAssistantResponse : ' ';
          console.log(`[Memory] Analysis started. User: "${instruction}", Agent: "${safeAssistantResponse.slice(0, 50)}..."`);

          if (instruction) {
            await this.memoryService.processTurn({
              sessionId,
              userId,
              userText: instruction,
              assistantText: safeAssistantResponse
            });
          }

          status = 'COMPLETED';
          finishReason = '正常结束';

        } catch (error) {
          subject.next({ data: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) });
          subject.complete();
          isSuccess = 0;
          status = 'FAILED';
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
          finishReason = '执行失败';
        } finally {
          const endTime = Date.now();
          const responseDurationSeconds = (endTime - startTime) / 1000;

          try {
            await conversationLogger.logConversation({
              userId: userId || '',
              sessionId,
              traceId,
              responseDurationSeconds: Math.round(responseDurationSeconds * 100) / 100,
              llmRounds,
              toolCallRounds,
              isExceedMaxRound,
              isSuccess,
              status,
              finishReason,
              llmModel: modelName,
              skillName: skillNames.join(','),
              toolName: toolNames.join(','),
              requestData: JSON.stringify({ instruction, context: llmContext, history: sanitizedHistory }),
              responseData: JSON.stringify({ response: fullAssistantResponse }),
              conversationContent: JSON.stringify({
                messages: [
                  ...sanitizedHistory,
                  { role: 'user', content: instruction },
                  { role: 'assistant', content: fullAssistantResponse }
                ]
              }),
              agentVersion: process.env.npm_package_version || '1.0.0',
              environment: process.env.NODE_ENV || 'development',
            });
          } catch (logError) {
            console.error(`[ConversationLogger] Failed to log conversation: ${logError}`);
          }
        }
      });
  }
}