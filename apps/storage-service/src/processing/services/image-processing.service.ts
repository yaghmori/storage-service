import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/variants.service';
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

    const sizes = options.sizes || [100, 200, 500, 1000];
    const formats = options.formats || ['webp', 'avif'];

    const variants = [];

    // Get image metadata for dimensions
    const imageMetadata = await sharp(fileBuffer).metadata();
    const originalWidth = imageMetadata.width || 0;
    const originalHeight = imageMetadata.height || 0;

    for (const size of sizes) {
      // Generate thumbnail
      const thumbnailBuffer = await sharp(fileBuffer)
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      const thumbnailKey = `${file.storageKey}_thumb_${size}`;
      await provider.upload(thumbnailKey, thumbnailBuffer, 'image/jpeg');

      const providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);
      await this.variantsService.create({
        fileId,
        variantType: 'thumbnail',
        variantKey: thumbnailKey,
        storageProviderId: providerConfig!.id,
        size: BigInt(thumbnailBuffer.length),
        width: size,
        height: size,
        format: 'jpeg',
      });

      variants.push({ type: 'thumbnail', size, key: thumbnailKey });

      // Generate format variants
      for (const format of formats) {
        const formatBuffer = await sharp(fileBuffer)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .toFormat(format as any)
          .toBuffer();

        const formatKey = `${file.storageKey}_${format}_${size}`;
        await provider.upload(formatKey, formatBuffer, `image/${format}`);

        await this.variantsService.create({
          fileId,
          variantType: format,
          variantKey: formatKey,
          storageProviderId: providerConfig!.id,
          size: BigInt(formatBuffer.length),
          width: size,
          height: size,
          format,
        });

        variants.push({ type: format, size, key: formatKey });
      }
    }

    // Update main file record with dimensions and processing status
    // All variant keys are stored in file_variants table - no duplication
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

