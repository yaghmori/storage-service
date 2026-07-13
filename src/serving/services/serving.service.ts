import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import { FilesService } from '../../files/services/files.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';

@Injectable()
export class ServingService {
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
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
      variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );

      if (!variant) {
        // Fallback to original if variant not found
        provider = await this.filesService.getFileProvider(fileId);
        key = file.key;
        contentType = file.mimeType;
      } else {
        // Use file's provider since variants are typically stored in the same provider
        provider = await this.filesService.getFileProvider(fileId);
        key = variant.key;
        contentType = variant.mimeType;
      }
    } else {
      // Serve original file
      provider = await this.filesService.getFileProvider(fileId);
      key = file.key;
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
        `inline; filename="${file.originalFilename}"`,
      );
      response.send(buffer);
    }

    return buffer;
  }
}

