import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import sharp from 'sharp';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/services/variants.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';

@Injectable()
export class ImageProcessingService {
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
    const fileBuffer = await provider.download(file.storageKey);

    const sizes = options.sizes || [200, 800];
    const formats = options.formats || ['webp'];

    const variants = [];

    // Get image metadata for dimensions
    const imageMetadata = await sharp(fileBuffer).metadata();
    const originalWidth = imageMetadata.width || 0;
    const originalHeight = imageMetadata.height || 0;

    const providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);

    // Get the base filename without extension
    const baseKey = file.storageKey.replace(extname(file.storageKey), '');

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
