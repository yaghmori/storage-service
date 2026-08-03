import { Injectable, Logger } from '@nestjs/common';

export type ChatVisionMessage = {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
};

@Injectable()
export class OpenaiCompatibleClient {
  private readonly logger = new Logger(OpenaiCompatibleClient.name);

  async listModels(input: {
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
  }): Promise<{ id: string; ownedBy?: string }[]> {
    const base = input.baseUrl.replace(/\/+$/, '');
    const url = `${base}/models`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 30_000,
    );
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      }
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `OpenAI-compatible models failed (${res.status}): ${text.slice(0, 300)}`,
        );
      }
      const json = (await res.json()) as {
        data?: Array<{ id?: string; owned_by?: string }>;
      };
      const items = Array.isArray(json.data) ? json.data : [];
      return items
        .filter((item): item is { id: string; owned_by?: string } =>
          typeof item?.id === 'string' && item.id.trim().length > 0,
        )
        .map((item) => ({
          id: item.id.trim(),
          ownedBy: item.owned_by,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      this.logger.error(
        `listModels error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async chatCompletions(input: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    messages: ChatVisionMessage[];
    temperature?: number;
    timeoutMs?: number;
    responseFormatJson?: boolean;
  }): Promise<string> {
    const base = input.baseUrl.replace(/\/+$/, '');
    const url = `${base}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 120_000,
    );

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      }

      const body: Record<string, unknown> = {
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        stream: false,
      };
      if (input.responseFormatJson) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `OpenAI-compatible chat failed (${res.status}): ${text.slice(0, 500)}`,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content?.trim()) {
        throw new Error('OpenAI-compatible chat returned empty content');
      }
      return content.trim();
    } catch (error) {
      this.logger.error(
        `chatCompletions error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
