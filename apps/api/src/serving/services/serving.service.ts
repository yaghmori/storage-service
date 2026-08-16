import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Response } from 'express';
import { extname } from 'path';
import { pipeline } from 'stream/promises';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import * as schema from '../../database/drizzle/schema';
import { FilesService } from '../../files/services/files.service';
import { PLATFORM_PROCESSING_DEFAULTS } from '../../processing/types/processing-settings';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';
import { buildContentDisposition } from '../utils/content-disposition';

type SharpModule = typeof import('sharp');

/** Variant types we can synthesize on the fly from a raster source image. */
const ON_DEMAND_IMAGE_VARIANTS: ReadonlySet<VariantType> = new Set([
  'thumbnail',
  'medium',
]);

type GeneratedVariant = {
  key: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class ServingService {
  private readonly logger = new Logger(ServingService.name);
  private sharpModule: SharpModule | null | undefined;

  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly analyticsService: AnalyticsService,
    private readonly storageFactory: StorageFactoryService,
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
    let key: string;
    let contentType: string;
    let contentLength: number | undefined;
    // When a variant is synthesized on demand we already hold its bytes and
    // stream them directly instead of re-reading from storage.
    let inlineBuffer: Buffer | null = null;

    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);

    if (variantType) {
      variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );

      if (variant) {
        key = variant.key;
        contentType = variant.mimeType;
        contentLength =
          variant.size != null ? Number(variant.size) : undefined;
      } else {
        // No stored variant. For preview-oriented image variants generate one
        // on the fly (and cache it) so previews never stream the full-size
        // original. Falls back to the original only if generation is not
        // possible (non-raster image, sharp unavailable, decode failure).
        const generated = await this.tryGenerateImageVariant(
          file,
          provider,
          variantType,
        );
        if (generated) {
          key = generated.key;
          contentType = generated.mimeType;
          contentLength = generated.size;
          inlineBuffer = generated.buffer;
        } else {
          key = file.key;
          contentType = file.mimeType;
          contentLength = Number(file.size);
        }
      }
    } else {
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
      return inlineBuffer ?? provider.download(key);
    }

    const safeName = file.originalFilename || 'file';
    response.setHeader('Content-Type', contentType);
    if (Number.isFinite(contentLength) && (contentLength as number) >= 0) {
      response.setHeader('Content-Length', String(contentLength));
    }
    response.setHeader(
      'Content-Disposition',
      buildContentDisposition(safeName, asDownload),
    );

    if (inlineBuffer) {
      response.end(inlineBuffer);
      return undefined;
    }

    const stream = await provider.openReadStream(key);
    await pipeline(stream, response);
    return undefined;
  }

  private async getSharp(): Promise<SharpModule | null> {
    if (this.sharpModule !== undefined) {
      return this.sharpModule;
    }
    try {
      const mod = await import('sharp');
      // CJS/ESM interop: runtime may expose the fn as default or the module.
      this.sharpModule = (mod.default ?? mod) as SharpModule;
    } catch (error) {
      this.sharpModule = null;
      this.logger.warn(
        `sharp unavailable; cannot generate preview variants on demand: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return this.sharpModule;
  }

  /**
   * Lazily produce a small preview variant (thumbnail/medium) for a raster
   * image that has no stored variant yet — e.g. files migrated in without the
   * processing pipeline. The generated variant is uploaded and recorded in
   * `file_variants` so subsequent requests hit the cached small object.
   *
   * Returns null (caller falls back to the original) when the source is not a
   * raster image, sharp is unavailable, or decoding/encoding fails.
   */
  private async tryGenerateImageVariant(
    file: Awaited<ReturnType<FilesService['findById']>>,
    provider: Awaited<ReturnType<FilesService['getFileProvider']>>,
    variantType: VariantType,
  ): Promise<GeneratedVariant | null> {
    if (!ON_DEMAND_IMAGE_VARIANTS.has(variantType)) {
      return null;
    }

    const mime = (file.mimeType || '').toLowerCase();
    // SVGs are already tiny/vector; rasterizing them adds no value.
    if (!mime.startsWith('image/') || mime === 'image/svg+xml') {
      return null;
    }

    const sharp = await this.getSharp();
    if (!sharp) {
      return null;
    }

    const slot =
      variantType === 'medium'
        ? PLATFORM_PROCESSING_DEFAULTS.imageVariants.medium
        : PLATFORM_PROCESSING_DEFAULTS.imageVariants.thumbnail;
    const maxWidth = Math.min(4096, Math.max(1, Math.floor(slot.maxEdge)));

    try {
      const source = await provider.download(file.key);
      const variantBuffer = await sharp(source)
        .rotate() // honor EXIF orientation before resizing
        .resize({ width: maxWidth, withoutEnlargement: true })
        .toFormat('webp', { quality: 85 })
        .toBuffer();

      const meta = await sharp(variantBuffer).metadata();
      const providerConfig = await this.storageFactory.getProviderConfig(
        file.storageProviderId,
      );
      if (!providerConfig) {
        this.logger.warn(
          `No storage provider config for file ${file.id}; serving original for ${variantType} preview`,
        );
        return null;
      }

      const baseKey = file.key.replace(extname(file.key), '');
      const variantKey = `${baseKey}_${variantType}_${maxWidth}.webp`;
      await provider.upload(variantKey, variantBuffer, 'image/webp');

      // Guard against a concurrent request having created the same variant.
      const existing = await this.variantsService.findByFileIdAndType(
        file.id,
        variantType,
      );
      if (!existing) {
        try {
          await this.variantsService.create({
            fileId: file.id,
            variantType,
            variantKey,
            storageProviderId: providerConfig.id,
            size: BigInt(variantBuffer.length),
            width: meta.width,
            height: meta.height,
            format: 'webp',
            quality: 85,
          });
        } catch (error) {
          // Losing a create race is fine — the object is uploaded and we still
          // serve the freshly generated bytes below.
          this.logger.debug(
            `Variant row create skipped for file ${file.id} (${variantType}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      return {
        key: variantKey,
        mimeType: 'image/webp',
        size: variantBuffer.length,
        buffer: variantBuffer,
      };
    } catch (error) {
      this.logger.warn(
        `On-demand ${variantType} generation failed for file ${file.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
