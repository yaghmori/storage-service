import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Response } from 'express';
import { pipeline } from 'stream/promises';
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
    asDownload = false,
  ) {
    let variant = null;
    let provider;
    let key: string;
    let contentType: string;
    let contentLength: number | undefined;

    const file = await this.filesService.findById(fileId);

    if (variantType) {
      variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );

      provider = await this.filesService.getFileProvider(fileId);
      if (!variant) {
        key = file.key;
        contentType = file.mimeType;
        contentLength = Number(file.size);
      } else {
        key = variant.key;
        contentType = variant.mimeType;
        contentLength =
          variant.size != null ? Number(variant.size) : undefined;
      }
    } else {
      provider = await this.filesService.getFileProvider(fileId);
      key = file.key;
      contentType = file.mimeType;
      contentLength = Number(file.size);
    }

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

    if (!response) {
      // Legacy callers that expect a Buffer
      return provider.download(key);
    }

    const safeName = (file.originalFilename || 'file').replace(
      /["\r\n]/g,
      '_',
    );
    response.setHeader('Content-Type', contentType);
    if (Number.isFinite(contentLength) && (contentLength as number) >= 0) {
      response.setHeader('Content-Length', String(contentLength));
    }
    response.setHeader(
      'Content-Disposition',
      `${asDownload ? 'attachment' : 'inline'}; filename="${safeName}"`,
    );

    const stream = await provider.openReadStream(key);
    await pipeline(stream, response);
    return undefined;
  }
}
