import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageConfig } from '../../config/storage.config';
import { OrganizationService } from '../organization.service';
import {
  EMPTY_ORG_LIMITS,
  extractLimitsFromMetadata,
  mergeLimitsSettings,
  OrgLimitsOverride,
  OrgLimitsSettings,
  withLimitsInMetadata,
} from '../types/org-limits';

export type ResolvedOrgLimits = ReturnType<typeof mergeLimitsSettings>;

@Injectable()
export class OrgLimitsService {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly storageConfig: StorageConfig,
  ) {}

  getPlatformDefaults(): {
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
  } {
    return {
      maxFileSizeBytes: this.storageConfig.maxFileSize,
      allowedMimeTypes: this.storageConfig.allowedMimeTypes,
    };
  }

  async resolve(orgId: string): Promise<ResolvedOrgLimits> {
    const org = await this.organizations.getById(orgId);
    const fromOrg = extractLimitsFromMetadata(org?.metadata);
    return mergeLimitsSettings(this.getPlatformDefaults(), fromOrg);
  }

  async getForOrg(orgId: string): Promise<
    OrgLimitsSettings & {
      defaults: {
        maxFileSizeBytes: number;
        allowedMimeTypes: string[];
      };
      effective: Omit<ResolvedOrgLimits, 'org'>;
    }
  > {
    const org = await this.organizations.getById(orgId);
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    const resolved = await this.resolve(orgId);
    return {
      ...resolved.org,
      defaults: this.getPlatformDefaults(),
      effective: {
        maxFileSizeBytes: resolved.maxFileSizeBytes,
        allowedMimeTypes: resolved.allowedMimeTypes,
        storageQuotaBytes: resolved.storageQuotaBytes,
        maxObjectCount: resolved.maxObjectCount,
      },
    };
  }

  async updateForOrg(
    orgId: string,
    patch: OrgLimitsOverride,
  ): Promise<OrgLimitsSettings> {
    const org = await this.organizations.getById(orgId);
    if (!org) {
      throw new NotFoundException(`Organization ${orgId} not found`);
    }
    const current = extractLimitsFromMetadata(org.metadata) ?? EMPTY_ORG_LIMITS;
    const next: OrgLimitsSettings = {
      maxFileSizeBytes:
        patch.maxFileSizeBytes !== undefined
          ? patch.maxFileSizeBytes
          : (current.maxFileSizeBytes ?? null),
      allowedMimeTypes:
        patch.allowedMimeTypes !== undefined
          ? patch.allowedMimeTypes
          : (current.allowedMimeTypes ?? null),
      storageQuotaBytes:
        patch.storageQuotaBytes !== undefined
          ? patch.storageQuotaBytes
          : (current.storageQuotaBytes ?? null),
      maxObjectCount:
        patch.maxObjectCount !== undefined
          ? patch.maxObjectCount
          : (current.maxObjectCount ?? null),
    };
    await this.organizations.update(orgId, {
      metadata: withLimitsInMetadata(org.metadata, next),
    });
    return next;
  }
}
