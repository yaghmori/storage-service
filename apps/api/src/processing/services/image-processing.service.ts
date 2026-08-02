import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import {
  enabledImageVariantSlots,
  imageVariantsFromLegacySizes,
  type ImageVariantJobSlot,
  type ImageVariantName,
  PLATFORM_PROCESSING_DEFAULTS,
} from '../types/processing-settings';

type SharpModule = typeof import('sharp');

export type ProcessImageOptions = {
  variants?: ImageVariantJobSlot[];
  /** Legacy: first → thumbnail, second → medium. */
  sizes?: number[];
  formats?: ('webp' | 'avif')[];
};

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private sharpModule: SharpModule | null | undefined;

  private async getSharp(): Promise<SharpModule> {
    if (this.sharpModule !== undefined) {
      if (!this.sharpModule) {
        throw new Error('sharp is not available in this runtime');
      }
      return this.sharpModule;
    }

    try {
      const mod = await import('sharp');
      // CJS/ESM interop: runtime may expose the fn as default or as the module itself
      this.sharpModule = (mod.default ?? mod) as SharpModule;
      return this.sharpModule;
    } catch (error) {
      this.sharpModule = null;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load sharp: ${message}`);
      throw new Error(`Image processing unavailable: ${message}`);
    }
  }
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly storageFactory: StorageFactoryService,
  ) {}

  private resolveSlots(options: ProcessImageOptions): ImageVariantJobSlot[] {
    if (options.variants && options.variants.length > 0) {
      return options.variants.filter(
        (s) =>
          (s.name === 'thumbnail' || s.name === 'medium') &&
          Number.isFinite(s.maxEdge) &&
          s.maxEdge > 0,
      );
    }

    if (options.sizes && options.sizes.length > 0) {
      const variants = imageVariantsFromLegacySizes(options.sizes);
      return enabledImageVariantSlots({ imageVariants: variants });
    }

    return enabledImageVariantSlots({
      imageVariants: PLATFORM_PROCESSING_DEFAULTS.imageVariants,
    });
  }

  async processImage(fileId: string, options: ProcessImageOptions = {}) {
    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);
    const fileBuffer = await provider.download(file.key);

    const slots = this.resolveSlots(options);
    const formats = options.formats?.length
      ? options.formats
      : PLATFORM_PROCESSING_DEFAULTS.imageFormats;
    const sharp = await this.getSharp();

    const variants = [];

    // Get image metadata for dimensions
    const imageMetadata = await sharp(fileBuffer).metadata();
    const originalWidth = imageMetadata.width || 0;
    const originalHeight = imageMetadata.height || 0;

    const providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);

    // Get the base filename without extension
    const baseKey = file.key.replace(extname(file.key), '');

    // Replace prior image variants so regenerate / re-queue is idempotent.
    const existing = await this.variantsService.findByFileId(fileId);
    for (const prior of existing) {
      if (prior.name !== 'thumbnail' && prior.name !== 'medium') continue;
      try {
        await provider.delete(prior.key);
      } catch (error) {
        this.logger.warn(
          `Failed to delete prior variant object ${prior.key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await this.variantsService.delete(prior.id);
    }

    for (const slot of slots) {
      const variantType: ImageVariantName = slot.name;
      // Max width in px — height follows source aspect ratio (never square-cropped).
      const maxWidth = Math.min(4096, Math.max(1, Math.floor(slot.maxEdge)));

      for (const format of formats) {
        const variantBuffer = await sharp(fileBuffer)
          .rotate() // honor EXIF orientation before measuring/resizing
          .resize({
            width: maxWidth,
            withoutEnlargement: true,
          })
          .toFormat(format, { quality: 85 })
          .toBuffer();

        const variantMeta = await sharp(variantBuffer).metadata();
        const outWidth = variantMeta.width ?? maxWidth;
        const outHeight = variantMeta.height ?? maxWidth;

        const variantKey = `${baseKey}_${variantType}_${maxWidth}.${format}`;
        await provider.upload(variantKey, variantBuffer, `image/${format}`);

        await this.variantsService.create({
          fileId,
          variantType,
          variantKey,
          storageProviderId: providerConfig!.id,
          size: BigInt(variantBuffer.length),
          width: outWidth,
          height: outHeight,
          format,
          quality: 85,
        });

        variants.push({
          type: variantType,
          size: maxWidth,
          format,
          key: variantKey,
          width: outWidth,
          height: outHeight,
        });
      }
    }

    // Update main file record with dimensions and processing status
    await this.filesService.updateFile(fileId, {
      width: originalWidth,
      height: originalHeight,
      aspectRatio: originalWidth && originalHeight
        ? `${originalWidth}:${originalHeight}`
        : undefined,
      isProcessed: true,
      processingStatus: 'completed',
    });

    return variants;
  }
}
