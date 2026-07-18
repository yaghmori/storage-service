import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { extname, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileDuplicationService } from '../../files/services/file-duplication.service';
import { FilesChecksumService } from '../../files/services/files-checksum.service';
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
    orgId: string,
    storageProviderId?: string,
    userId?: string,
    storageKeyOverride?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }

    const buffer = file.buffer;
    const sha256Hash = await this.checksumService.calculateSHA256(buffer);

    const existingFiles = await this.filesService.findByHash(sha256Hash, orgId);
    if (existingFiles.length > 0) {
      const originalFile = existingFiles.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0];

      this.logger.log(`Duplicate file detected: ${originalFile.id}, skipping upload and storage`);

      const updatedFile = await this.filesService.incrementReferenceCount(originalFile.id);

      this.logger.log(
        `Duplicate upload detected. Incremented reference count for original file ${originalFile.id}. New count: ${updatedFile?.referenceCount || originalFile.referenceCount + 1}`,
      );

      await this.fileDuplicationService.markAsDuplicate(
        originalFile.id,
        orgId,
        'sha256',
        undefined,
        userId,
      );

      this.logger.log(`Recorded duplicate upload event for file ${originalFile.id}`);

      const fileToReturn = updatedFile || originalFile;
      return {
        id: fileToReturn.id,
        originalFileName: fileToReturn.originalFilename,
        mimeType: fileToReturn.mimeType,
        size: Number(fileToReturn.size),
        isDuplicate: true,
        originalFileId: originalFile.id,
        message: `File already exists in the system. Using existing file (ID: ${originalFile.id}). Reference count increased to ${fileToReturn.referenceCount}.`,
        uploadedToStorage: false,
        createdAt: fileToReturn.createdAt,
      };
    }

    const providerConfig = await this.storageFactory.getProviderConfig(storageProviderId, orgId);
    if (!providerConfig) {
      throw new BadRequestException('No storage provider available');
    }
    if (providerConfig.orgId && providerConfig.orgId !== orgId) {
      throw new BadRequestException('Storage provider does not belong to this organization');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const extension = extname(file.originalname);
    const uuid = uuidv4();
    const key =
      this.resolveStorageKey(storageKeyOverride) ??
      `${year}/${month}/${day}/${uuid}${extension}`;
    const fileName = storageKeyOverride ? basename(key) : `${uuid}${extension}`;

    const provider = await this.storageFactory.getProvider(providerConfig.id);

    try {
      await provider.upload(key, buffer, file.mimetype);
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload to storage provider (${providerConfig.type}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const config = providerConfig.config as { bucket?: string };
    let fileRecord;
    try {
      fileRecord = await this.filesService.createFile({
        orgId,
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

    this.scheduleProcessingJobs(fileRecord.id, file.mimetype, orgId);

    return {
      id: fileRecord.id,
      originalFileName: fileRecord.originalFilename,
      mimeType: fileRecord.mimeType,
      size: Number(fileRecord.size),
      isDuplicate: false,
      message: 'File uploaded successfully.',
      uploadedToStorage: true,
      storageKey: key,
      createdAt: fileRecord.createdAt,
    };
  }

  /**
   * Allow service-to-service uploads (e.g. build artifacts) to use stable keys.
   * Keys must be relative object paths without traversal segments.
   */
  private resolveStorageKey(storageKeyOverride?: string): string | undefined {
    if (!storageKeyOverride?.trim()) {
      return undefined;
    }

    const normalized = storageKeyOverride.trim().replace(/^\/+/, '');
    if (!normalized || normalized.includes('..') || normalized.includes('\\')) {
      throw new BadRequestException('Invalid storage key');
    }

    if (!/^[a-zA-Z0-9_./-]+$/.test(normalized)) {
      throw new BadRequestException('Invalid storage key characters');
    }

    return normalized;
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
  private async scheduleProcessingJobs(
    fileId: string,
    mimetype: string,
    _orgId: string,
  ): Promise<void> {
    try {
      if (mimetype.startsWith('image/')) {
        await this.queuesService.addImageProcessingJob({
          fileId,
          orgId: _orgId,
          options: {
            sizes: [200, 800],
            formats: ['webp'],
          },
        });
        this.logger.log(`Image processing job scheduled for file ${fileId}`);
      }

      if (mimetype.startsWith('video/')) {
        await this.queuesService.addVideoProcessingJob({
          fileId,
          orgId: _orgId,
          options: {
            previewFrames: 3,
            thumbnail: true,
          },
        });
        this.logger.log(`Video processing job scheduled for file ${fileId}`);
      }

      await this.queuesService.addMetadataExtractionJob({ fileId, orgId: _orgId });
      this.logger.log(`Metadata extraction job scheduled for file ${fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to schedule processing jobs for file ${fileId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
