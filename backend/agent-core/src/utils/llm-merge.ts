/**
 * Merge optional per-user overrides (from gateway context) with OPENAI_* env defaults.
 * User non-empty string wins per field.
 *
 * 模型名称优先级：
 *   1. user-level overrides.llmModelName（用户在前端设置过）
 *   2. process.env.OPENAI_MODEL_NAME（.env 默认值，例如 deepseek-v4-pro）
 *   3. fallback 'gpt-4'（最后兜底，确保始终有值）
 *
 * 注意：fallback 'gpt-4' 只在 env 也没设时使用，避免因为默认硬编码而覆盖用户的 .env 配置。
 */
export type LlmOverrides = {
  llmApiBase?: string;
  llmModelName?: string;
  llmApiKey?: string;
};

export function pickMergedLlm(overrides: LlmOverrides | undefined | null): {
  apiKey: string | undefined;
  modelName: string;
  baseUrl: string | undefined;
} {
  const pick = (u: string | undefined, e: string | undefined) =>
    u != null && String(u).trim() !== '' ? String(u).trim() : e;

  const apiKey = pick(overrides?.llmApiKey, process.env.OPENAI_API_KEY);
  const modelName = pick(overrides?.llmModelName, process.env.OPENAI_MODEL_NAME) || 'gpt-4';
  const baseUrl = pick(overrides?.llmApiBase, process.env.OPENAI_API_BASE);

  return { apiKey, modelName, baseUrl };
}
