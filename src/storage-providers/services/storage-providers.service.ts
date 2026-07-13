import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { CreateStorageProviderRequest, StorageProviderResponse } from '@platform/messaging-contracts';
import { StorageProvidersRepository } from '../repositories/storage-providers.repository';
import { toStorageProviderResponse } from '../storage-providers.mapper';
import { StorageProviderConfig, StorageProviderType } from '../types/storage-provider-config.types';

@Injectable()
export class StorageProvidersService implements OnModuleInit {
  private readonly logger = new Logger(StorageProvidersService.name);

  constructor(
    @Inject(StorageProvidersRepository)
    private readonly repository: StorageProvidersRepository,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultProvider();
  }

  private async ensureDefaultProvider() {
    try {
      // Check if a default provider exists
      const defaultProvider = await this.repository.findDefault();

      if (!defaultProvider) {
        this.logger.warn('No default storage provider found. Attempting to set one...');

        // Get all active providers
        const activeProviders = await this.repository.findActive();

        if (activeProviders.length === 0) {
          this.logger.error('No active storage providers found. Please create at least one provider.');
          return;
        }

        // Set the first active provider as default
        await this.repository.update(activeProviders[0].id, { isDefault: true });
        this.logger.log(`Set storage provider "${activeProviders[0].name}" (ID: ${activeProviders[0].id}) as default`);
      } else {
        this.logger.log(`Default storage provider: "${defaultProvider.name}" (ID: ${defaultProvider.id})`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure default provider exists', error instanceof Error ? error.stack : undefined);
    }
  }

  async findAll(): Promise<StorageProviderResponse[]> {
    const providers = await this.repository.findAll();
    return providers.map(toStorageProviderResponse);
  }

  async findById(id: string): Promise<StorageProviderResponse | null> {
    const provider = await this.repository.findById(id);
    return toStorageProviderResponse(provider);
  }

  async findActive(): Promise<StorageProviderResponse[]> {
    const providers = await this.repository.findActive();
    return providers.map(toStorageProviderResponse);
  }

  async create(data: CreateStorageProviderRequest): Promise<StorageProviderResponse> {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await this.unsetOtherDefaults();
    }
    // Type assertion: CreateStorageProviderRequest schema ensures name, type, and config are required
    const provider = await this.repository.create(data as {
      name: string;
      type: StorageProviderType;
      config: StorageProviderConfig;
      isActive?: boolean;
      isDefault?: boolean;
    });
    return toStorageProviderResponse(provider);
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      type: StorageProviderType;
      config: StorageProviderConfig;
      isActive: boolean;
      isDefault: boolean;
    }>,
  ): Promise<StorageProviderResponse | null> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.unsetOtherDefaults(id);
    }
    const provider = await this.repository.update(id, data);
    return toStorageProviderResponse(provider);
  }

  private async unsetOtherDefaults(excludeId?: string) {
    const defaultProviders = await this.repository.findDefault();
    if (defaultProviders && defaultProviders.id !== excludeId) {
      await this.repository.update(defaultProviders.id, { isDefault: false });
    }
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }
}

