import { Controller, Post, Body } from '@nestjs/common';
import { OptimizeTextService } from './optimize-text.service';
import { pickMergedLlm } from '../../utils/llm-merge';
import { LoggerService } from '../../utils/logger.service';

@Controller('features/optimize-text')
export class OptimizeTextController {
  constructor(private readonly logger: LoggerService) {}

  @Post()
  async optimize(
    @Body()
    body: {
      fieldId: string;
      currentText: string;
      context?: string;
      llmApiBase?: string;
      llmModelName?: string;
      llmApiKey?: string;
    },
  ) {
    if (!body.fieldId || !body.currentText) {
      return { error: 'fieldId and currentText are required' };
    }

    const llm = pickMergedLlm(body);
    console.log('[optimize-text] llm config: hasApiKey=' + !!llm.apiKey + ' model=' + llm.modelName + ' baseUrl=' + (llm.baseUrl || 'default'));
    if (!llm.apiKey) {
      return { error: 'NO_API_KEY', hint: '请先在设置中配置 LLM API Key' };
    }

    const start = Date.now();
    const svc = new OptimizeTextService(llm.apiKey || '', llm.modelName, llm.baseUrl);

    const timeoutPromise = new Promise<{ optimizedText: string; explanation: string }>((resolve) =>
      setTimeout(() => resolve({
        optimizedText: body.currentText,
        explanation: 'AI 优化超时（120s），请稍后重试。',
      }), 120000)
    );

    const result = await Promise.race([
      svc.optimize(body.fieldId, body.currentText, body.context),
      timeoutPromise,
    ]);

    result.optimizedText = formatOptimizedText(body.fieldId, result.optimizedText);

    const duration = Date.now() - start;
    this.logger.logLlm('output', {
      feature: 'text-optimize',
      fieldId: body.fieldId,
      duration: `${duration}ms`,
    });

    return result;
  }
}

const JSON_FIELD_IDS = new Set([
  'api_parameter_contract',
  'api_async_poll',
  'api_headers',
  'api_query',
  'api_body',
]);

function formatOptimizedText(fieldId: string, text: unknown): string {
  if (typeof text !== 'string') {
    if (text && typeof text === 'object') {
      try { return JSON.stringify(text, null, 2); } catch { return String(text); }
    }
    return text as string;
  }
  if (!JSON_FIELD_IDS.has(fieldId)) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}
