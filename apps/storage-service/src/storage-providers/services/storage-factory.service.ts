import { Injectable } from '@nestjs/common';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { StorageProvidersRepository } from '../repositories/storage-providers.repository';
import { S3StorageService } from './s3-storage.service';
import { MinIOStorageService } from './minio-storage.service';
import { LocalStorageService } from './local-storage.service';

@Injectable()
export class StorageFactoryService {
  constructor(
    private readonly repository: StorageProvidersRepository,
    private readonly s3Service: S3StorageService,
    private readonly minioService: MinIOStorageService,
    private readonly localService: LocalStorageService,
  ) {}

  async getProvider(providerId: number): Promise<IStorageProvider> {
    const provider = await this.repository.findById(providerId);
    if (!provider || !provider.isActive) {
      throw new Error(`Storage provider ${providerId} not found or inactive`);
    }

    return this.createProviderInstance(provider);
  }

  async getDefaultProvider(): Promise<IStorageProvider> {
    const providers = await this.repository.findActive();
    if (providers.length === 0) {
      throw new Error('No active storage providers found');
    }

    // Use first active provider as default (can be enhanced with priority/round-robin)
    return this.createProviderInstance(providers[0]);
  }

  async getProviderConfig(providerId?: number) {
    if (providerId) {
      return this.repository.findById(providerId);
    }
    const providers = await this.repository.findActive();
    return providers[0] || null;
  }

  private createProviderInstance(provider: any): IStorageProvider {
    switch (provider.type) {
      case 's3':
        return this.s3Service.createInstance(provider.config);
      case 'minio':
        return this.minioService.createInstance(provider.config);
      case 'local':
        return this.localService.createInstance(provider.config);
      default:
        throw new Error(`Unknown storage provider type: ${provider.type}`);
    }
  }
}

