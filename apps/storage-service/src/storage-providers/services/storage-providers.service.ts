import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StorageProvidersRepository } from '../repositories/storage-providers.repository';
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

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async findActive() {
    return this.repository.findActive();
  }

  async create(data: {
    name: string;
    type: StorageProviderType;
    config: StorageProviderConfig;
    isActive?: boolean;
    isDefault?: boolean;
  }) {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await this.unsetOtherDefaults();
    }
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<{
    name: string;
    type: StorageProviderType;
    config: StorageProviderConfig;
    isActive: boolean;
    isDefault: boolean;
  }>) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.unsetOtherDefaults(id);
    }
    return this.repository.update(id, data);
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

