import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../organization.service';
import {
  extractRetentionFromMetadata,
  mergeRetentionSettings,
  OrgRetentionOverride,
  OrgRetentionSettings,
  PLATFORM_RETENTION_DEFAULTS,
  withRetentionInMetadata,
} from '../types/org-retention';

@Injectable()
export class OrgRetentionService {
  constructor(private readonly organizations: OrganizationService) {}

  getPlatformDefaults(): OrgRetentionSettings {
    return { ...PLATFORM_RETENTION_DEFAULTS };
  }

  async resolve(orgId: string): Promise<OrgRetentionSettings> {
    const org = await this.organizations.getById(orgId);
    const fromOrg = extractRetentionFromMetadata(org?.metadata);
    return mergeRetentionSettings(PLATFORM_RETENTION_DEFAULTS, fromOrg);
  }

  async getForOrg(orgId: string): Promise<
    OrgRetentionSettings & { defaults: OrgRetentionSettings }
  > {
    const org = await this.organizations.getById(orgId);
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    const settings = await this.resolve(orgId);
    return {
      ...settings,
      defaults: this.getPlatformDefaults(),
    };
  }

  async updateForOrg(
    orgId: string,
    patch: OrgRetentionOverride,
  ): Promise<OrgRetentionSettings> {
    const org = await this.organizations.getById(orgId);
    if (!org) {
      throw new NotFoundException(`Organization ${orgId} not found`);
    }
    const next = mergeRetentionSettings(
      PLATFORM_RETENTION_DEFAULTS,
      extractRetentionFromMetadata(org.metadata),
      patch,
    );
    await this.organizations.update(orgId, {
      metadata: withRetentionInMetadata(org.metadata, next),
    });
    return next;
  }
}
