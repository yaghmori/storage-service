import { Injectable } from '@nestjs/common';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { StorageProvidersRepository } from '../repositories/storage-providers.repository';
import { LocalConfig, MinIOConfig, S3Config, StorageProvider } from '../types/storage-provider-config.types';
import { LocalStorageService } from './local-storage.service';
import { MinIOStorageService } from './minio-storage.service';
import { S3StorageService } from './s3-storage.service';

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

  async getDefaultProvider(): Promise<IStorageProvider> {
    // First try to find a provider marked as default
    let provider = await this.repository.findDefault();

    // If no default provider is set, use the first active provider
    if (!provider) {
      const providers = await this.repository.findActive();
      if (providers.length === 0) {
        throw new Error('No active storage providers found');
      }
      provider = providers[0];
    }

    return await this.createProviderInstance(provider as StorageProvider);
  }

  async getProviderConfig(providerId?: string) {
    if (providerId) {
      return this.repository.findById(providerId);
    }

    // Try to find default provider first
    const defaultProvider = await this.repository.findDefault();
    if (defaultProvider) {
      return defaultProvider;
    }

    // Fallback to first active provider
    const providers = await this.repository.findActive();
    return providers[0] || null;
  }

  async findProviderByType(type: 'local' | 'minio' | 's3') {
    const providers = await this.repository.findByType(type);
    return providers[0] || null;
  }

  private async createProviderInstance(provider: StorageProvider): Promise<IStorageProvider> {
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

