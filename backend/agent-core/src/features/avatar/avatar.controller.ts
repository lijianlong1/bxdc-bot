import { Controller, Post, Body } from '@nestjs/common';
import { AvatarService } from './service';
import { randomUUID } from 'crypto';
import { LoggerService } from '../../utils/logger.service';
import { pickMergedLlm } from '../../utils/llm-merge';

@Controller('features/avatar')
export class AvatarController {
  constructor(private readonly logger: LoggerService) {}

  private serviceForRequest(overrides: { llmApiBase?: string; llmModelName?: string; llmApiKey?: string }) {
    const llm = pickMergedLlm(overrides);
    return new AvatarService(llm.apiKey || '', llm.modelName, llm.baseUrl);
  }

  @Post('generate')
  async generateAvatar(
    @Body()
    body: {
      nickname: string;
      llmApiBase?: string;
      llmModelName?: string;
      llmApiKey?: string;
    },
  ) {
    if (!body.nickname) {
      return { avatar: '👤' };
    }
    const llm = pickMergedLlm(body);
    if (!llm.apiKey) {
      return { avatar: '👤', error: 'NO_API_KEY' };
    }
    const svc = this.serviceForRequest(body);
    const emoji = await svc.generateAvatar(body.nickname);
    return { avatar: emoji };
  }

  @Post('greeting')
  async generateGreeting(@Body() body: { nickname: string; avatar: string }) {
    const start = Date.now();
    const svc = this.serviceForRequest({});
    const content = !body.nickname
      ? '欢迎回来！'
      : await svc.generateGreeting(body.nickname, body.avatar || '👤');

    const duration = Date.now() - start;
    this.logger.logLlm('output', {
      feature: 'greeting',
      nickname: body.nickname,
      duration: `${duration}ms`,
      response: content
    });

    const messageId = randomUUID();
    return {
      agent: {
        messages: [
          {
            lc: 1,
            type: 'constructor',
            id: ['langchain_core', 'messages', 'AIMessage'],
            kwargs: {
              id: messageId,
              content,
              additional_kwargs: {},
              response_metadata: {},
              type: 'ai',
              tool_calls: [],
              invalid_tool_calls: [],
              usage_metadata: {},
            },
          },
        ],
      },
    };
  }
}
