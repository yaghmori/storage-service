import { Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import { unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from '../../files/services/files.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantsService } from '../../variants/services/variants.service';

@Injectable()
export class VideoProcessingService {
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly storageFactory: StorageFactoryService
  ) {}

  async processVideo(
    fileId: string,
    options: { previewFrames?: number; thumbnail?: boolean } = {}
  ) {
    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);
    const fileBuffer = await provider.download(file.key);

    const tempDir = tmpdir();
    const tempInputPath = join(tempDir, `input_${fileId}_${Date.now()}.mp4`);
    const tempOutputPath = join(tempDir, `output_${fileId}_${Date.now()}.jpg`);

    try {
      // Write buffer to temp file
      await writeFile(tempInputPath, fileBuffer);

      const previewFrames = options.previewFrames ?? 3;
      const thumbnail = options.thumbnail !== false;

      const variants = [];

      // Replace prior video variants so regenerate is idempotent.
      const existing = await this.variantsService.findByFileId(fileId);
      for (const prior of existing) {
        if (
          prior.name !== 'thumbnail' &&
          prior.name !== 'preview-frame' &&
          prior.name !== 'thumbnail-video' &&
          prior.name !== 'preview-video'
        ) {
          continue;
        }
        try {
          await provider.delete(prior.key);
        } catch {
          // ignore missing objects
        }
        await this.variantsService.delete(prior.id);
      }

      if (thumbnail) {
        // Generate thumbnail from first frame
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempInputPath)
            .screenshots({
              timestamps: ['00:00:01'],
              filename: 'thumb.jpg',
              folder: tempDir,
              size: '320x240',
            })
            .on('end', () => resolve())
            .on('error', reject);
        });

        const thumbPath = join(tempDir, 'thumb.jpg');
        const thumbBuffer = await require('fs').promises.readFile(thumbPath);
        const thumbKey = `${file.key}_thumb.jpg`;

        await provider.upload(thumbKey, thumbBuffer, 'image/jpeg');

        const providerConfig = await this.storageFactory.getProviderConfig(
          file.storageProviderId
        );
        await this.variantsService.create({
          fileId,
          variantType: 'thumbnail',
          variantKey: thumbKey,
          storageProviderId: providerConfig!.id,
          size: BigInt(thumbBuffer.length),
          format: 'jpeg',
        });

        variants.push({ type: 'thumbnail', key: thumbKey });
        await unlink(thumbPath).catch((error) => {
          console.error(error);
        });
      }

      // Extract preview frames
      for (let i = 1; i <= previewFrames; i++) {
        const timestamp = `00:00:${i * 2}`;
        const framePath = join(tempDir, `frame_${i}.jpg`);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempInputPath)
            .screenshots({
              timestamps: [timestamp],
              filename: `frame_${i}.jpg`,
              folder: tempDir,
              size: '640x480',
            })
            .on('end', () => resolve())
            .on('error', reject);
        });

        const frameBuffer = await require('fs').promises.readFile(framePath);
        const frameKey = `${file.key}_frame_${i}.jpg`;

        await provider.upload(frameKey, frameBuffer, 'image/jpeg');

        const providerConfig = await this.storageFactory.getProviderConfig(
          file.storageProviderId
        );
        await this.variantsService.create({
          fileId,
          variantType: 'preview-frame',
          variantKey: frameKey,
          storageProviderId: providerConfig!.id,
          size: BigInt(frameBuffer.length),
          format: 'jpeg',
        });

        variants.push({ type: 'preview-frame', frame: i, key: frameKey });
        await unlink(framePath).catch((error) => {
          console.error(error);
        });
      }

      return variants;
    } finally {
      // Cleanup temp files
      await unlink(tempInputPath).catch((error) => {
        console.error(error);
      });
      await unlink(tempOutputPath).catch((error) => {
        console.error(error);
      });
    }
  }
}
