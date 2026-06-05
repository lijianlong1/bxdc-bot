import axios from 'axios';

export interface ConversationLog {
  userId: string;
  sessionId: string;
  traceId?: string;
  responseDurationSeconds?: number;
  llmRounds?: number;
  toolCallRounds?: number;
  isExceedMaxRound?: number;
  isSuccess?: number;
  status?: string;
  finishReason?: string;
  llmModel?: string;
  skillName?: string;
  toolName?: string;
  logLevel?: string;
  logMessage?: string;
  errorMessage?: string;
  errorStackTrace?: string;
  requestData?: string;
  responseData?: string;
  conversationContent?: string;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  agentVersion?: string;
  environment?: string;
}

export interface ToolCallLog {
  traceId: string;
  sessionId: string;
  userId?: string;
  toolName: string;
  skillName?: string;
  toolCallId?: string;
  requestParams?: string;
  responseResult?: string;
  status?: string;
  errorMessage?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  llmInputTokens?: number;
  llmOutputTokens?: number;
  httpStatus?: number;
  gatewayUrl?: string;
}

export class ConversationLogger {
  private gatewayUrl: string;

  constructor() {
    this.gatewayUrl = process.env.JAVA_GATEWAY_URL || 'http://localhost:18080';
  }

  async logConversation(log: ConversationLog): Promise<void> {
    try {
      const url = `${this.gatewayUrl}/api/internal/conversation-logs`;
      await axios.post(url, log, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      console.log(`[ConversationLogger] Logged conversation for session ${log.sessionId}`);
    } catch (error) {
      console.error(`[ConversationLogger] Failed to log conversation: ${error}`);
    }
  }

  async logToolCall(log: ToolCallLog): Promise<void> {
    try {
      const url = `${this.gatewayUrl}/api/internal/tool-call-logs`;
      await axios.post(url, log, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      console.log(`[ConversationLogger] Logged tool call: ${log.toolName} for session ${log.sessionId}`);
    } catch (error) {
      console.error(`[ConversationLogger] Failed to log tool call: ${error}`);
    }
  }
}