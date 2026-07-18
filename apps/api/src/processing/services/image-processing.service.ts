import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';

type SharpModule = typeof import('sharp');

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

  async processImage(
    fileId: string,
    options: { sizes?: number[]; formats?: ('webp' | 'avif')[] } = {},
  ) {
    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);
    const fileBuffer = await provider.download(file.key);

    const sizes = options.sizes || [200, 800];
    const formats = options.formats || ['webp'];
    const sharp = await this.getSharp();

    const variants = [];

    // Get image metadata for dimensions
    const imageMetadata = await sharp(fileBuffer).metadata();
    const originalWidth = imageMetadata.width || 0;
    const originalHeight = imageMetadata.height || 0;

    const providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);

    // Get the base filename without extension
    const baseKey = file.key.replace(extname(file.key), '');

    for (const size of sizes) {
      for (const format of formats) {
        // Generate resized image in the specified format
        const variantBuffer = await sharp(fileBuffer)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .toFormat(format, { quality: 85 })
          .toBuffer();

        // Proper file extension: base_200.webp or base_800.webp
        const variantKey = `${baseKey}_${size}.${format}`;
        await provider.upload(variantKey, variantBuffer, `image/${format}`);

        // Determine variant type based on size
        const variantType = size <= 200 ? 'thumbnail' : 'medium';

        await this.variantsService.create({
          fileId,
          variantType,
          variantKey,
          storageProviderId: providerConfig!.id,
          size: BigInt(variantBuffer.length),
          width: size,
          height: size,
          format,
          quality: 85,
        });

        variants.push({ type: variantType, size, format, key: variantKey });
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
