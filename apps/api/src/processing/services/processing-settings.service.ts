import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../../organizations/organization.service';
import {
  extractProcessingFromMetadata,
  mergeProcessingSettings,
  OrgProcessingSettings,
  PLATFORM_PROCESSING_DEFAULTS,
  ProcessingSettingsOverride,
  withProcessingInMetadata,
} from '../types/processing-settings';

@Injectable()
export class ProcessingSettingsService {
  constructor(private readonly organizations: OrganizationService) {}

  getPlatformDefaults(): OrgProcessingSettings {
    return { ...PLATFORM_PROCESSING_DEFAULTS };
  }

  /**
   * Resolve settings: upload override → org metadata.processing → platform defaults.
   */
  async resolve(
    orgId: string,
    uploadOverride?: ProcessingSettingsOverride | null,
  ): Promise<OrgProcessingSettings> {
    const org = await this.organizations.getById(orgId);
    const fromOrg = extractProcessingFromMetadata(org?.metadata);
    return mergeProcessingSettings(
      PLATFORM_PROCESSING_DEFAULTS,
      fromOrg,
      uploadOverride,
    );
  }

  async getForOrg(orgId: string): Promise<OrgProcessingSettings> {
    const org = await this.organizations.getById(orgId);
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return this.resolve(orgId);
  }

  async updateForOrg(
    orgId: string,
    patch: ProcessingSettingsOverride,
  ): Promise<OrgProcessingSettings> {
    const org = await this.organizations.getById(orgId);
    if (!org) {
      throw new NotFoundException(`Organization ${orgId} not found`);
    }
    const next = mergeProcessingSettings(
      PLATFORM_PROCESSING_DEFAULTS,
      extractProcessingFromMetadata(org.metadata),
      patch,
    );
    await this.organizations.update(orgId, {
      metadata: withProcessingInMetadata(org.metadata, next),
    });
    return next;
  }
}
