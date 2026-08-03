import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from '../../files/services/files.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantsService } from '../../variants/services/variants.service';

const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly storageFactory: StorageFactoryService,
  ) {}

  async processVideo(
    fileId: string,
    options: { previewFrames?: number; thumbnail?: boolean } = {},
  ) {
    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);

    const tempDir = tmpdir();
    const tempInputPath = join(tempDir, `input_${fileId}_${Date.now()}.mp4`);

    try {
      await provider.downloadToFile(file.key, tempInputPath);

      const previewFrames = options.previewFrames ?? 3;
      const thumbnail = options.thumbnail !== false;
      const variants: Array<Record<string, unknown>> = [];

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
        await this.runScreenshots(tempInputPath, tempDir, {
          timestamps: ['00:00:01'],
          filename: 'thumb.jpg',
          size: '320x240',
        });

        const thumbPath = join(tempDir, 'thumb.jpg');
        const thumbBuffer = await readFile(thumbPath);
        const thumbKey = `${file.key}_thumb.jpg`;

        await provider.upload(thumbKey, thumbBuffer, 'image/jpeg');

        const providerConfig = await this.storageFactory.getProviderConfig(
          file.storageProviderId,
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
          this.logger.warn(`Failed to unlink ${thumbPath}: ${error}`);
        });
      }

      for (let i = 1; i <= previewFrames; i++) {
        const timestamp = `00:00:${String(i * 2).padStart(2, '0')}`;
        const frameName = `frame_${i}.jpg`;

        await this.runScreenshots(tempInputPath, tempDir, {
          timestamps: [timestamp],
          filename: frameName,
          size: '640x480',
        });

        const framePath = join(tempDir, frameName);
        const frameBuffer = await readFile(framePath);
        const frameKey = `${file.key}_frame_${i}.jpg`;

        await provider.upload(frameKey, frameBuffer, 'image/jpeg');

        const providerConfig = await this.storageFactory.getProviderConfig(
          file.storageProviderId,
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
          this.logger.warn(`Failed to unlink ${framePath}: ${error}`);
        });
      }

      return variants;
    } finally {
      await unlink(tempInputPath).catch((error) => {
        this.logger.warn(`Failed to unlink ${tempInputPath}: ${error}`);
      });
    }
  }

  private runScreenshots(
    inputPath: string,
    folder: string,
    opts: { timestamps: string[]; filename: string; size: string },
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .screenshots({
          timestamps: opts.timestamps,
          filename: opts.filename,
          folder,
          size: opts.size,
        })
        .on('end', () => resolve())
        .on('error', reject);

      // fluent-ffmpeg timeout is in seconds when available
      const commandWithTimeout = command as unknown as {
        timeout?: (seconds: number) => unknown;
      };
      if (typeof commandWithTimeout.timeout === 'function') {
        commandWithTimeout.timeout(
          Math.ceil(FFMPEG_TIMEOUT_MS / 1000),
        );
      }
    });
  }
}
