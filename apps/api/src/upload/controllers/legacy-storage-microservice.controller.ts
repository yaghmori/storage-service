import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MESSAGE_PATTERNS, success, type ApiResponse } from '../../lib/contracts';
import { looksLikeUuid } from '../../common/guards/auth.guard';
import { FilesService } from '../../files/services/files.service';
import { OrganizationService } from '../../organizations/organization.service';
import { SignedUrlService } from '../../serving/services/signed-url.service';
import { UploadService } from '../services/upload.service';

/**
 * Legacy TCP pattern aliases (Allyfe / older clients).
 * Prefer HTTP multipart upload + MESSAGE_PATTERNS.STORAGE.* patterns for new integrations.
 *
 * TCP has no API-key auth — callers must send orgId (UUID) or orgSlug.
 * Falling back to AUTH_DEFAULT_ORG_ID alone is why files land under Default.
 */
@Controller()
export class LegacyStorageMicroserviceController {
  private readonly logger = new Logger(LegacyStorageMicroserviceController.name);

  constructor(
    private readonly uploadService: UploadService,
    private readonly signedUrlService: SignedUrlService,
    private readonly filesService: FilesService,
    private readonly organizations: OrganizationService,
  ) {}

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.UPLOAD_FILE)
  async uploadFile(
    @Payload()
    data: {
      /** Allyfe client sends base64 under `file` */
      file?: string | Buffer;
      buffer?: string | Buffer;
      content?: string | Buffer;
      originalname?: string;
      filename?: string;
      mimetype?: string;
      mimeType?: string;
      folder?: string;
      storageProviderId?: string;
      userId?: string;
      requestId?: string;
      orgId?: string;
      orgSlug?: string;
      tenantId?: string;
    },
  ): Promise<ApiResponse<unknown> & { success: boolean; id?: string; url?: string }> {
    const raw = data.file ?? data.buffer ?? data.content;
    if (raw == null) {
      throw new Error('uploadFile requires file, buffer, or content (base64 string or Buffer)');
    }
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from(String(raw), 'base64');

    const filename = data.originalname || data.filename || 'upload.bin';
    const keyOverride = data.folder
      ? `${data.folder.replace(/\/$/, '')}/${filename}`
      : undefined;

    const orgId = await this.resolveTcpOrgId(data);
    if (!orgId) {
      throw new Error(
        'uploadFile requires orgId (UUID) or orgSlug/tenantId in payload, or AUTH_DEFAULT_ORG_ID on the server',
      );
    }

    const result = await this.uploadService.uploadFile(
      {
        buffer,
        originalname: filename,
        mimetype: data.mimetype || data.mimeType || 'application/octet-stream',
      },
      orgId,
      data.storageProviderId,
      data.userId,
      keyOverride,
    );

    let url: string | undefined;
    try {
      const signed = await this.signedUrlService.generateSignedUrl(
        result.id,
        undefined,
        3600,
      );
      url = signed.url;
    } catch {
      url = undefined;
    }

    return {
      ...success({ ...result, url }, { requestId: data.requestId }),
      success: true,
      id: result.id,
      url,
    };
  }

  private async resolveTcpOrgId(data: {
    orgId?: string;
    orgSlug?: string;
    tenantId?: string;
  }): Promise<string | undefined> {
    const rawId = data.orgId?.trim();
    const rawSlug = (data.orgSlug || data.tenantId)?.trim();

    if (rawId && looksLikeUuid(rawId)) {
      return this.organizations.resolveOrgRef({ orgId: rawId });
    }

    // Treat non-UUID orgId as a slug (common client mistake).
    const slug = rawSlug || (rawId && !looksLikeUuid(rawId) ? rawId : undefined);
    if (slug) {
      return this.organizations.resolveOrgRef({ orgSlug: slug });
    }

    const fallback = process.env.AUTH_DEFAULT_ORG_ID?.trim();
    if (fallback) {
      this.logger.warn(
        `TCP upload missing orgId/orgSlug — using AUTH_DEFAULT_ORG_ID (${fallback}). Files will land under that org (often Default).`,
      );
      return looksLikeUuid(fallback)
        ? fallback
        : this.organizations.resolveOrgRef({ orgSlug: fallback });
    }
    return undefined;
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_ASSET_URL)
  async getAssetUrl(
    @Payload()
    data: {
      assetId?: string;
      fileId?: string;
      id?: string;
      expiresIn?: number;
      variant?: string;
      requestId?: string;
    },
  ): Promise<
    ApiResponse<{ url: string; expiresAt: string; expiresIn: number; signedUrl: string }> & {
      success: boolean;
      signedUrl?: string;
      expiresIn?: number;
    }
  > {
    const fileId = data.assetId || data.fileId || data.id;
    if (!fileId) {
      throw new Error('getAssetUrl requires assetId or fileId');
    }
    const expiresIn =
      typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn)
        ? data.expiresIn
        : undefined;
    const variantType = data.variant?.trim()
      ? (data.variant.trim() as import('../../variants/repositories/variants.repository').VariantType)
      : undefined;
    const signed = await this.signedUrlService.generateSignedUrl(
      fileId,
      variantType,
      expiresIn,
    );
    const expiresAt = new Date(Date.now() + signed.expiresIn * 1000).toISOString();
    return {
      ...success(
        {
          url: signed.url,
          signedUrl: signed.url,
          expiresAt,
          expiresIn: signed.expiresIn,
        },
        { requestId: data.requestId },
      ),
      success: true,
      signedUrl: signed.url,
      expiresIn: signed.expiresIn,
    };
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.DELETE_ASSET)
  async deleteAsset(
    @Payload()
    data: {
      assetId?: string;
      id?: string;
      fileId?: string;
      hardDelete?: boolean;
      requestId?: string;
    },
  ): Promise<ApiResponse<unknown> & { success: boolean }> {
    const id = data.assetId || data.id || data.fileId;
    if (!id) {
      throw new Error('deleteAsset requires assetId or id');
    }
    const result = await this.filesService.deleteFile(id, data.hardDelete || false);
    return { ...success(result, { requestId: data.requestId }), success: true };
  }
}
