import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { v4 as uuidv4 } from 'uuid';

export type LlmLogDirection = 'request' | 'response';

export interface LlmLogEntry {
  id: string;
  sessionId: string;
  invocationId: string;
  direction: LlmLogDirection;
  stage: 'chat_model';
  timestamp: string;
  summary: string;
  modelName?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

export interface LlmLogEvent {
  type: 'llm_log';
  entry: LlmLogEntry;
}

type LlmCallbackEmitter = (event: LlmLogEvent) => void;

@Injectable()
export class LoggerService {
  private readonly logsDir = path.join(process.cwd(), 'logs');
  private readonly memoryLogPath = path.join(this.logsDir, 'memory.log');
  private readonly llmLogPath = path.join(this.logsDir, 'llm.log');

  constructor() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private writeLog(filePath: string, message: string) {
    const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] ${message}\n---\n`;
    fs.appendFileSync(filePath, logEntry, 'utf8');
  }

  private writeJsonLine(filePath: string, value: unknown) {
    fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
  }

  logMemory(action: 'store' | 'retrieve', data: any) {
    const message = `Action: ${action.toUpperCase()}\nData: ${JSON.stringify(data, null, 2)}`;
    this.writeLog(this.memoryLogPath, message);
  }

  logLlm(type: 'input' | 'output' | 'agent_thought' | 'tool_result', data: any) {
    this.writeJsonLine(this.llmLogPath, {
      format: 'legacy',
      type,
      timestamp: new Date().toISOString(),
      data: this.sanitizeValue(data),
    });
  }

  createLlmCallbackHandler(sessionId: string, emit: LlmCallbackEmitter) {
    const runMetadata = new Map<string, { modelName?: string }>();

    return BaseCallbackHandler.fromMethods({
      handleChatModelStart: async (
        serialized: any,
        messages: any,
        runId: string,
        _parentRunId?: string,
        extraParams?: any,
      ) => {
        const modelName = this.extractModelName(serialized, extraParams);
        runMetadata.set(String(runId), { modelName });
        const requestEntry = this.appendLlmEntry({
          sessionId,
          invocationId: String(runId),
          direction: 'request',
          summary: this.buildRequestSummary(modelName, messages),
          modelName,
          request: {
            modelName,
            params: this.sanitizeInvocationParams(extraParams),
            messages: this.sanitizeMessages(messages),
          },
        });
        emit({ type: 'llm_log', entry: requestEntry });
      },
      handleLLMEnd: async (output: any, runId: string) => {
        const invocationId = String(runId);
        const modelName = runMetadata.get(invocationId)?.modelName;
        const responsePayload = this.sanitizeLlmOutput(output);
        const responseEntry = this.appendLlmEntry({
          sessionId,
          invocationId,
          direction: 'response',
          summary: this.buildResponseSummary(responsePayload),
          modelName,
          response: responsePayload,
        });
        emit({ type: 'llm_log', entry: responseEntry });
      },
      handleLLMError: async (error: any, runId: string) => {
        const invocationId = String(runId);
        const modelName = runMetadata.get(invocationId)?.modelName;
        const responseEntry = this.appendLlmEntry({
          sessionId,
          invocationId,
          direction: 'response',
          summary: 'LLM 调用失败',
          modelName,
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
        emit({ type: 'llm_log', entry: responseEntry });
      },
    });
  }

  private appendLlmEntry(input: Omit<LlmLogEntry, 'id' | 'stage' | 'timestamp'>): LlmLogEntry {
    const entry: LlmLogEntry = {
      id: uuidv4(),
      stage: 'chat_model',
      timestamp: new Date().toISOString(),
      ...input,
    };
    this.writeJsonLine(this.llmLogPath, entry);
    return entry;
  }

  /**
   * 回调里的 extraParams 会带上 LangChain/LangGraph 噪音：
   * - `invocation_params` 与顶层的 `messages` 重复，不必再记一遍；
   * - 函数值（如 LangGraph 的 writer、interrupt）会被序列化成整段源码。
   * 日志里只保留与「请求上下文」相关的可序列化字段，再交给 sanitizeValue 脱敏。
   */
  private stripLangChainExtraParamsNoise(value: unknown, depth = 0): unknown {
    if (depth > 10) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'function') return undefined;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const item of value) {
        if (typeof item === 'function') continue;
        const cleaned = this.stripLangChainExtraParamsNoise(item, depth + 1);
        if (cleaned !== undefined) out.push(cleaned);
      }
      return out;
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'invocation_params') continue;
        if (typeof raw === 'function') continue;
        const cleaned = this.stripLangChainExtraParamsNoise(raw, depth + 1);
        if (cleaned !== undefined) {
          result[key] = cleaned;
        }
      }
      return result;
    }
    return String(value);
  }

  private sanitizeInvocationParams(extraParams: any) {
    const stripped = this.stripLangChainExtraParamsNoise(extraParams);
    if (stripped === undefined) return undefined;
    return this.sanitizeValue(stripped);
  }

  /**
   * LangChain 消息常用 `type`: human / ai / system / tool；OpenAI wire 为 user / assistant / …。
   * 结构化日志与 llmOrg.log 中的 role 对齐，便于对照。
   */
  private normalizeLangChainRoleToOpenAi(role: unknown): string {
    if (typeof role !== 'string') return 'unknown';
    const r = role.toLowerCase().trim();
    if (r === 'human' || r === 'humanmessage') return 'user';
    if (r === 'ai' || r === 'aimessage' || r === 'aimessagechunk') return 'assistant';
    if (r === 'system' || r === 'systemmessage') return 'system';
    if (r === 'tool' || r === 'toolmessage') return 'tool';
    if (r === 'user' || r === 'assistant' || r === 'system' || r === 'tool') return r;
    return role;
  }

  private sanitizeMessages(messages: any) {
    const batches = Array.isArray(messages) ? messages : [messages];
    const firstBatch = Array.isArray(batches[0]) ? batches[0] : batches;
    return firstBatch.map((message: any) => ({
      role: this.normalizeLangChainRoleToOpenAi(
        message?.kwargs?.role ?? message?.role ?? message?.type ?? 'unknown',
      ),
      content: this.sanitizeValue(message?.kwargs?.content ?? message?.content ?? ''),
      name: message?.kwargs?.name ?? message?.name,
      toolCalls: this.sanitizeValue(
        message?.kwargs?.tool_calls
        ?? message?.tool_calls
        ?? message?.additional_kwargs?.tool_calls
        ?? [],
      ),
    }));
  }

  private sanitizeLlmOutput(output: any) {
    const generations = Array.isArray(output?.generations) ? output.generations : [];
    const flattened = generations.flat();
    const normalizedGenerations = flattened.map((generation: any) => {
      const message = generation?.message;
      const content = message?.kwargs?.content ?? message?.content ?? generation?.text ?? '';
      return {
        role: this.normalizeLangChainRoleToOpenAi(
          message?.kwargs?.role ?? message?.role ?? message?.type ?? 'assistant',
        ),
        text: typeof generation?.text === 'string' ? generation.text : undefined,
        content: this.sanitizeValue(content),
        toolCalls: this.sanitizeValue(
          message?.kwargs?.tool_calls
          ?? message?.tool_calls
          ?? message?.additional_kwargs?.tool_calls
          ?? [],
        ),
        generationInfo: this.sanitizeValue(generation?.generationInfo ?? generation?.generation_info),
      };
    });

    return {
      generations: normalizedGenerations,
      llmOutput: this.sanitizeValue(output?.llmOutput ?? output?.llm_output ?? {}),
    };
  }

  private extractModelName(serialized: any, extraParams: any): string | undefined {
    return serialized?.kwargs?.modelName
      ?? serialized?.kwargs?.model
      ?? extraParams?.model
      ?? extraParams?.modelName
      ?? extraParams?.invocation_params?.model
      ?? undefined;
  }

  private buildRequestSummary(modelName: string | undefined, messages: any): string {
    const sanitizedMessages = this.sanitizeMessages(messages);
    const parts = [
      modelName ? `模型 ${modelName}` : '模型请求',
      `${sanitizedMessages.length} 条消息`,
    ];
    return parts.join(' · ');
  }

  private buildResponseSummary(response: Record<string, any>): string {
    const generations = Array.isArray(response.generations) ? response.generations : [];
    const firstGeneration = generations[0];
    const text = typeof firstGeneration?.content === 'string'
      ? firstGeneration.content
      : typeof firstGeneration?.text === 'string'
        ? firstGeneration.text
        : '';
    const toolCalls = Array.isArray(firstGeneration?.toolCalls) ? firstGeneration.toolCalls.length : 0;
    const summaryParts = [];
    if (text) {
      summaryParts.push(`返回 ${text.length > 24 ? `${text.slice(0, 24)}...` : text}`);
    }
    if (toolCalls > 0) {
      summaryParts.push(`${toolCalls} 个 tool call`);
    }
    return summaryParts.join(' · ') || '收到模型响应';
  }

  private sanitizeValue(value: any, depth = 0): any {
    if (depth > 10) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, raw] of Object.entries(value)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('apikey') || lowerKey.includes('token') || lowerKey.includes('authorization')) {
          result[key] = '[redacted]';
          continue;
        }
        result[key] = this.sanitizeValue(raw, depth + 1);
      }
      return result;
    }
    return String(value);
  }
}
