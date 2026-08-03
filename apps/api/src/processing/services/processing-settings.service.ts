import { Injectable } from '@nestjs/common';
import { OrgProcessorsService } from './org-processors.service';
import {
  mergeProcessingSettings,
  OrgProcessingSettings,
  PLATFORM_PROCESSING_DEFAULTS,
  ProcessingSettingsOverride,
} from '../types/processing-settings';

@Injectable()
export class ProcessingSettingsService {
  constructor(private readonly orgProcessors: OrgProcessorsService) {}

  getPlatformDefaults(): OrgProcessingSettings {
    return { ...PLATFORM_PROCESSING_DEFAULTS };
  }

  /**
   * Resolve settings from org_processors, with an optional upload override.
   */
  async resolve(
    orgId: string,
    uploadOverride?: ProcessingSettingsOverride | null,
  ): Promise<OrgProcessingSettings> {
    const rows = await this.orgProcessors.ensureDefaults(orgId);
    const fromOrg = this.orgProcessors.toLegacyProcessingSettings(rows);
    return mergeProcessingSettings(
      PLATFORM_PROCESSING_DEFAULTS,
      fromOrg,
      uploadOverride,
    );
  }

  async getForOrg(orgId: string): Promise<OrgProcessingSettings> {
    return this.resolve(orgId);
  }

  async updateForOrg(
    orgId: string,
    patch: ProcessingSettingsOverride,
  ): Promise<OrgProcessingSettings> {
    return this.orgProcessors.updateFromLegacySettings(
      orgId,
      patch as Record<string, unknown>,
    );
  }
}
