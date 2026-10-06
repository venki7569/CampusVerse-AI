import { config } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { createLogger } from '../../utils/logger';

const log = createLogger('GeminiProvider');

export type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AIProviderGenerateInput = {
  systemInstruction: string;
  messages: AIChatMessage[];
  contextData?: string;
};

export type AIProviderGenerateResult = {
  content: string;
  model: string;
};

export interface AIProvider {
  isConfigured(): boolean;
  generate(input: AIProviderGenerateInput): Promise<AIProviderGenerateResult>;
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

export class GeminiProvider implements AIProvider {
  isConfigured(): boolean {
    return Boolean(config.gemini.apiKey && config.gemini.apiKey.length > 0);
  }

  async generate(input: AIProviderGenerateInput): Promise<AIProviderGenerateResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        'AI assistant is not configured. Set GEMINI_API_KEY to enable Gemini.',
        503,
        'SERVICE_UNAVAILABLE',
      );
    }

    const userContextBlock = input.contextData
      ? `\n\n--- CAMPUS DATA CONTEXT (use only this data) ---\n${input.contextData}\n--- END CONTEXT ---`
      : '';

    const contents = input.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const lastIdx = contents.length - 1;
    const last = contents[lastIdx]!;
    contents[lastIdx] = {
      ...last,
      parts: [{ text: `${last.parts[0]?.text ?? ''}${userContextBlock}` }],
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.gemini.model)}:generateContent?key=${encodeURIComponent(config.gemini.apiKey)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.gemini.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: input.systemInstruction }] },
          contents,
          generationConfig: {
            maxOutputTokens: config.gemini.maxOutputTokens,
            temperature: 0.2,
          },
        }),
      });

      const payload = (await response.json()) as GeminiResponse;

      if (!response.ok) {
        log.warn('Gemini API error', { status: response.status, message: payload.error?.message });
        throw new AppError(payload.error?.message ?? 'Gemini API request failed', 502, 'BAD_GATEWAY');
      }

      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        throw new AppError('Gemini returned an empty response', 502, 'BAD_GATEWAY');
      }

      return { content: text, model: config.gemini.model };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AppError('Gemini request timed out', 504, 'GATEWAY_TIMEOUT');
      }
      log.warn('Gemini provider failure', { err });
      throw new AppError('AI provider is temporarily unavailable', 502, 'BAD_GATEWAY');
    } finally {
      clearTimeout(timeout);
    }
  }
}
