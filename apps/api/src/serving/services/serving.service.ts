import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Response } from 'express';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import * as schema from '../../database/drizzle/schema';
import { FilesService } from '../../files/services/files.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';

@Injectable()
export class ServingService {
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly analyticsService: AnalyticsService,
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async streamFile(
    fileId: string,
    variantType?: VariantType,
    _size?: number,
    response?: Response,
    ipAddress?: string,
    userAgent?: string,
  ) {
    let variant = null;
    let provider;
    let key;
    let contentType: string;

    const file = await this.filesService.findById(fileId);

    if (variantType) {
      variant = await this.variantsService.findByFileIdAndType(fileId, variantType);

      if (!variant) {
        provider = await this.filesService.getFileProvider(fileId);
        key = file.key;
        contentType = file.mimeType;
      } else {
        provider = await this.filesService.getFileProvider(fileId);
        key = variant.key;
        contentType = variant.mimeType;
      }
    } else {
      provider = await this.filesService.getFileProvider(fileId);
      key = file.key;
      contentType = file.mimeType;
    }

    const buffer = await provider.download(key);

    if (ipAddress || userAgent) {
      const [row] = await this.db
        .select({ orgId: schema.files.orgId })
        .from(schema.files)
        .where(eq(schema.files.id, fileId))
        .limit(1);
      if (row?.orgId) {
        await this.analyticsService.logDownload({
          fileId: file.id,
          orgId: row.orgId,
          variantId: variant?.id,
          ipAddress,
          userAgent,
        });
      }
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
