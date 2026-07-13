import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MESSAGE_PATTERNS, success, type ApiResponse } from '@platform/messaging-contracts';
import { FilesService } from '../../files/services/files.service';
import { SignedUrlService } from '../../serving/services/signed-url.service';
import { UploadService } from '../services/upload.service';

/**
 * Legacy TCP pattern aliases (Allyfe / older clients).
 * Prefer HTTP multipart upload + MESSAGE_PATTERNS.STORAGE.* patterns for new integrations.
 */
@Controller()
export class LegacyStorageMicroserviceController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly signedUrlService: SignedUrlService,
    private readonly filesService: FilesService,
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

    const result = await this.uploadService.uploadFile(
      {
        buffer,
        originalname: filename,
        mimetype: data.mimetype || data.mimeType || 'application/octet-stream',
      },
      data.storageProviderId,
      data.userId,
      keyOverride,
    );

    let url: string | undefined;
    try {
      url = await this.signedUrlService.generateSignedUrl(result.id, undefined, 3600);
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

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_ASSET_URL)
  async getAssetUrl(
    @Payload()
    data: {
      assetId?: string;
      fileId?: string;
      id?: string;
      expiresIn?: number;
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
    const expiresIn = data.expiresIn || 3600;
    const url = await this.signedUrlService.generateSignedUrl(fileId, undefined, expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return {
      ...success({ url, signedUrl: url, expiresAt, expiresIn }, { requestId: data.requestId }),
      success: true,
      signedUrl: url,
      expiresIn,
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
