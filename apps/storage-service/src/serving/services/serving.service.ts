import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import { FilesService } from '../../files/services/files.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';

@Injectable()
export class ServingService {
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly storageFactory: StorageFactoryService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async streamFile(
    fileId: string,
    variantType?: VariantType,
    size?: number,
    response?: Response,
    ipAddress?: string,
    userAgent?: string,
  ) {
    let variant = null;
    let provider;
    let key;
    let contentType: string;

    // Get file first (needed for fallback and metadata)
    const file = await this.filesService.findById(fileId);

    if (variantType) {
      // Query variants table - single source of truth
      let variants = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );

      if (!variants || variants.length === 0) {
        // Fallback to original if variant not found
        provider = await this.filesService.getFileProvider(fileId);
        key = file.storageKey;
        contentType = file.mimeType;
      } else {
        // If size specified, filter by size
        if (size) {
          variants = variants.filter(
            (v: any) => v.width === size || v.height === size,
          );
        }

        // Use first matching variant (or best match)
        variant = variants[0] || variants.find((v: any) => v.width === size) || variants[0];
        provider = await this.storageFactory.getProvider(variant.storageProviderId);
        key = variant.variantKey;
        contentType = `image/${variant.format || 'jpeg'}`;
      }
    } else {
      // Serve original file
      provider = await this.filesService.getFileProvider(fileId);
      key = file.storageKey;
      contentType = file.mimeType;
    }

    const buffer = await provider.download(key);

    // Log download
    if (ipAddress || userAgent) {
      await this.analyticsService.logDownload({
        fileId: file.id,
        variantId: variant?.id,
        ipAddress,
        userAgent,
      });
    }

    if (response) {
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Length', buffer.length);
      response.setHeader(
        'Content-Disposition',
        `inline; filename="${file.originalFileName}"`,
      );
      response.send(buffer);
    }

    return buffer;
  }
}

