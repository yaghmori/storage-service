import { Injectable } from '@nestjs/common';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { constants as fsConstants, promises as fs } from 'fs';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { StorageProvidersRepository } from '../repositories/storage-providers.repository';
import {
  LocalConfig,
  MinIOConfig,
  S3Config,
  StorageProvider,
} from '../types/storage-provider-config.types';
import { LocalStorageService } from './local-storage.service';
import { MinIOStorageService } from './minio-storage.service';
import { S3StorageService } from './s3-storage.service';

export type ProviderConnectivityResult = {
  ok: boolean;
  type: string;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class StorageFactoryService {
  constructor(
    private readonly repository: StorageProvidersRepository,
    private readonly s3Service: S3StorageService,
    private readonly minioService: MinIOStorageService,
    private readonly localService: LocalStorageService,
  ) {}

  async getProvider(providerId: string): Promise<IStorageProvider> {
    const provider = await this.repository.findById(providerId);
    if (!provider || !provider.isActive) {
      throw new Error(`Storage provider ${providerId} not found or inactive`);
    }

    return await this.createProviderInstance(provider as StorageProvider);
  }

  async getDefaultProvider(orgId?: string): Promise<IStorageProvider> {
    let provider = await this.repository.findDefault(orgId);

    if (!provider) {
      const providers = await this.repository.findActive(orgId);
      if (providers.length === 0) {
        throw new Error('No active storage providers found');
      }
      provider = providers[0];
    }

    return await this.createProviderInstance(provider as StorageProvider);
  }

  async getProviderConfig(providerId?: string, orgId?: string) {
    if (providerId) {
      return this.repository.findById(providerId, orgId);
    }

    const defaultProvider = await this.repository.findDefault(orgId);
    if (defaultProvider) {
      return defaultProvider;
    }

    const providers = await this.repository.findActive(orgId);
    return providers[0] || null;
  }

  async findProviderByType(type: 'local' | 'minio' | 's3', orgId?: string) {
    const providers = await this.repository.findByType(type, orgId);
    return providers[0] || null;
  }

  /**
   * Live connectivity probe for admin "Test connection".
   * Works for active and inactive providers (validates saved config).
   */
  async testConnectivity(
    providerId: string,
    orgId?: string,
  ): Promise<ProviderConnectivityResult> {
    const started = Date.now();
    const provider = await this.repository.findById(providerId, orgId);
    if (!provider) {
      return {
        ok: false,
        type: 'unknown',
        latencyMs: Date.now() - started,
        message: 'Provider not found',
      };
    }

    try {
      switch (provider.type) {
        case 'local':
          await this.probeLocal(provider.config as LocalConfig);
          break;
        case 'minio':
          // createInstance already checks/creates the bucket over the network
          await this.minioService.createInstance(provider.config as MinIOConfig);
          break;
        case 's3':
          await this.probeS3(provider.config as S3Config);
          break;
        default:
          throw new Error(`Unknown storage provider type: ${provider.type}`);
      }

      const latencyMs = Date.now() - started;
      const bucketOrPath =
        provider.type === 'local'
          ? String((provider.config as LocalConfig).path || './uploads')
          : String((provider.config as MinIOConfig | S3Config).bucket || '');

      return {
        ok: true,
        type: provider.type,
        latencyMs,
        message: provider.isActive
          ? `Connected (${latencyMs}ms)`
          : `Connected (${latencyMs}ms) — provider is inactive`,
        details: {
          target: bucketOrPath,
          isActive: provider.isActive,
        },
      };
    } catch (error) {
      return {
        ok: false,
        type: provider.type,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async probeLocal(config: LocalConfig): Promise<void> {
    const basePath = config.path || './uploads';
    await fs.mkdir(basePath, { recursive: true });
    await fs.access(basePath, fsConstants.R_OK | fsConstants.W_OK);
  }

  private async probeS3(config: S3Config): Promise<void> {
    if (!config.accessKeyId?.trim() || !config.secretAccessKey?.trim()) {
      throw new Error('S3 accessKeyId and secretAccessKey are required');
    }
    if (!config.bucket?.trim()) {
      throw new Error('S3 bucket is required');
    }

    const client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle || false,
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } finally {
      client.destroy();
    }
  }

  private async createProviderInstance(
    provider: StorageProvider,
  ): Promise<IStorageProvider> {
    const { type, config } = provider;

    switch (type) {
      case 's3':
        return this.s3Service.createInstance(config as S3Config);
      case 'minio':
        return await this.minioService.createInstance(config as MinIOConfig);
      case 'local':
        return this.localService.createInstance(config as LocalConfig);
      default:
        throw new Error(`Unknown storage provider type: ${type}`);
    }
  }
}
