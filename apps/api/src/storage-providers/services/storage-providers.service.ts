import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { CreateStorageProviderRequest, StorageProviderResponse } from '../../lib/contracts';
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
      // Bootstrap only: look for any org-level default (no cross-org unset here).
      const defaultProvider = await this.repository.findDefault();

      if (!defaultProvider) {
        this.logger.warn('No default storage provider found. Attempting to set one...');

        const activeProviders = await this.repository.findActive();

        if (activeProviders.length === 0) {
          this.logger.error('No active storage providers found. Please create at least one provider.');
          return;
        }

        await this.repository.update(activeProviders[0].id, { isDefault: true });
        this.logger.log(`Set storage provider "${activeProviders[0].name}" (ID: ${activeProviders[0].id}) as default`);
      } else {
        this.logger.log(`Default storage provider: "${defaultProvider.name}" (ID: ${defaultProvider.id})`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure default provider exists', error instanceof Error ? error.stack : undefined);
    }
  }

  async findAll(orgId?: string): Promise<StorageProviderResponse[]> {
    const providers = await this.repository.findAll(orgId);
    return providers.map(toStorageProviderResponse);
  }

  async findById(id: string, orgId?: string): Promise<StorageProviderResponse | null> {
    const provider = await this.repository.findById(id, orgId);
    return toStorageProviderResponse(provider);
  }

  async findActive(orgId?: string): Promise<StorageProviderResponse[]> {
    const providers = await this.repository.findActive(orgId);
    return providers.map(toStorageProviderResponse);
  }

  /** Org-scoped default provider lookup. */
  async findDefault(orgId: string): Promise<StorageProviderResponse | null> {
    const provider = await this.repository.findDefault(orgId);
    return toStorageProviderResponse(provider);
  }

  async create(data: CreateStorageProviderRequest & { orgId: string }): Promise<StorageProviderResponse> {
    if (data.isDefault) {
      await this.unsetOtherDefaults(data.orgId);
    }
    const provider = await this.repository.create({
      orgId: data.orgId,
      name: data.name,
      type: data.type as StorageProviderType,
      config: data.config as StorageProviderConfig,
      isActive: data.isActive,
      isDefault: data.isDefault,
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
    orgId?: string,
  ): Promise<StorageProviderResponse | null> {
    const existing = await this.repository.findById(id, orgId);
    if (!existing) {
      return null;
    }
    // If setting as default, unset other defaults within the same org only.
    if (data.isDefault) {
      await this.unsetOtherDefaults(existing.orgId, id);
    }
    const provider = await this.repository.update(id, data);
    return toStorageProviderResponse(provider);
  }

  /** Clear other defaults in the same organization only. */
  private async unsetOtherDefaults(orgId: string, excludeId?: string) {
    const defaultProvider = await this.repository.findDefault(orgId);
    if (defaultProvider && defaultProvider.id !== excludeId) {
      await this.repository.update(defaultProvider.id, { isDefault: false });
    }
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }
}
