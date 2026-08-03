import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OpenaiCompatiblePlatformDefaults = {
  baseUrl?: string;
  apiKey?: string;
  visionModel?: string;
  textModel?: string;
  timeoutMs: number;
};

@Injectable()
export class ProcessorConfig {
  constructor(private readonly config: ConfigService) {}

  get credentialsEncryptionKey(): string {
    return (
      this.config.get<string>('PROCESSOR_CREDENTIALS_ENCRYPTION_KEY')?.trim() ||
      this.config.get<string>('AI_CREDENTIALS_ENCRYPTION_KEY')?.trim() ||
      ''
    );
  }

  get openaiCompatibleDefaults(): OpenaiCompatiblePlatformDefaults {
    const timeoutRaw = this.config.get<string>('PROCESSOR_BACKEND_OPENAI_COMPATIBLE_TIMEOUT_MS');
    const timeoutMs = timeoutRaw ? Number(timeoutRaw) : 120_000;
    return {
      baseUrl:
        this.config.get<string>('PROCESSOR_BACKEND_OPENAI_COMPATIBLE_BASE_URL')?.trim() ||
        this.config.get<string>('OLLAMA_BASE_URL')?.trim() ||
        undefined,
      apiKey:
        this.config.get<string>('PROCESSOR_BACKEND_OPENAI_COMPATIBLE_API_KEY')?.trim() ||
        undefined,
      visionModel:
        this.config
          .get<string>('PROCESSOR_BACKEND_OPENAI_COMPATIBLE_VISION_MODEL')
          ?.trim() ||
        this.config.get<string>('OLLAMA_VISION_MODEL')?.trim() ||
        'llava',
      textModel:
        this.config
          .get<string>('PROCESSOR_BACKEND_OPENAI_COMPATIBLE_TEXT_MODEL')
          ?.trim() || undefined,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000,
    };
  }
}
