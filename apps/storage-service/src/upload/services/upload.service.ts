import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FilesChecksumService } from '../../files/services/files-checksum.service';
import { FileDuplicationService } from '../../files/services/file-duplication.service';
import { FilesService } from '../../files/services/files.service';
import { QueuesService } from '../../queues/queues.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly checksumService: FilesChecksumService,
    private readonly storageFactory: StorageFactoryService,
    private readonly queuesService: QueuesService,
    private readonly fileDuplicationService: FileDuplicationService,
  ) {}

  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    storageProviderId?: number,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Calculate checksum first to check for duplicates
    const buffer = file.buffer;
    const sha256Hash = await this.checksumService.calculateSHA256(buffer);

    // Check for duplicates BEFORE uploading to storage
    const existingFiles = await this.filesService.findByHash(sha256Hash);
    if (existingFiles.length > 0) {
      // File is a duplicate - use the oldest file as the original
      const originalFile = existingFiles.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];

      this.logger.log(`Duplicate file detected: ${originalFile.id}, skipping upload and storage`);

      // Create a lightweight duplicate file record (no actual upload to storage)
      const duplicateRecord = await this.filesService.createFile({
        storageProviderId: originalFile.storageProviderId,
        storageKey: originalFile.storageKey, // Reuse the same storage key
        storageBucket: originalFile.storageBucket || undefined,
        fileName: `${uuidv4()}${extname(file.originalname)}`, // Unique filename for tracking
        originalFileName: file.originalname,
        fileExtension: extname(file.originalname).replace('.', ''),
        mimeType: file.mimetype,
        size: BigInt(buffer.length),
        fileHash: sha256Hash,
      });

      // Create duplicate relationship in fileDuplicates table
      await this.fileDuplicationService.markAsDuplicate(
        duplicateRecord.id,
        originalFile.id,
        'sha256',
      );

      this.logger.log(
        `Created duplicate record ${duplicateRecord.id} linked to original ${originalFile.id}`,
      );

      // Return the duplicate record (not the original)
      // This gives the user a unique file ID they can reference
      return duplicateRecord;
    }

    // Get provider config
    const providerConfig = await this.storageFactory.getProviderConfig(storageProviderId);
    if (!providerConfig) {
      throw new BadRequestException('No storage provider available');
    }

    // Generate date-based key path for better organization (S3 best practice)
    // Pattern: YYYY/MM/DD/uuid.ext
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const extension = extname(file.originalname);
    const uuid = uuidv4();
    const key = `${year}/${month}/${day}/${uuid}${extension}`;
    const fileName = `${uuid}${extension}`;

    // Get storage provider instance
    const provider = await this.storageFactory.getProvider(providerConfig.id);

    // Upload to storage
    try {
      await provider.upload(key, buffer, file.mimetype);
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload to storage provider (${providerConfig.type}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Create file record
    const config = providerConfig.config as { bucket?: string };
    let fileRecord;
    try {
      fileRecord = await this.filesService.createFile({
        storageProviderId: providerConfig.id,
        storageKey: key,
        storageBucket: config.bucket,
        fileName,
        originalFileName: file.originalname,
        fileExtension: extension.replace('.', ''),
        mimeType: file.mimetype,
        size: BigInt(buffer.length),
        fileHash: sha256Hash,
      });
    } catch (error) {
      // If file creation fails, try to clean up the uploaded file
      try {
        await provider.delete(key);
      } catch (deleteError) {
        this.logger.error('Failed to clean up uploaded file:', deleteError);
      }
      throw error;
    }

    if (!fileRecord?.id) {
      throw new BadRequestException('File record not found');
    }

    // Schedule processing jobs in background - don't block upload response
    this.scheduleProcessingJobs(fileRecord.id, file.mimetype);

    return fileRecord;
  }

  /**
   * Schedule processing jobs based on file type
   * This runs asynchronously and doesn't block the upload response
   *
   * Best practices for image variants:
   * - Thumbnail (200px): For lists, grids, and previews
   * - Medium (800px): For detail views and responsive images
   * - WebP format: Modern, efficient compression (80-90% smaller than JPEG)
   */
  private async scheduleProcessingJobs(fileId: string, mimetype: string): Promise<void> {
    try {
      // Schedule image processing for images
      if (mimetype.startsWith('image/')) {
        await this.queuesService.addImageProcessingJob({
          fileId,
          options: {
            // Only generate essential sizes: thumbnail and medium
            sizes: [200, 800],
            // Only WebP - widely supported and excellent compression
            formats: ['webp'],
          },
        });
        this.logger.log(`Image processing job scheduled for file ${fileId}`);
      }

      // Schedule video processing for videos
      if (mimetype.startsWith('video/')) {
        await this.queuesService.addVideoProcessingJob({
          fileId,
          options: {
            previewFrames: 3,
            thumbnail: true,
          },
        });
        this.logger.log(`Video processing job scheduled for file ${fileId}`);
      }

      // Always schedule metadata extraction
      await this.queuesService.addMetadataExtractionJob({ fileId });
      this.logger.log(`Metadata extraction job scheduled for file ${fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to schedule processing jobs for file ${fileId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
