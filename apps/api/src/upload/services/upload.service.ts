import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { extname, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileDuplicationService } from '../../files/services/file-duplication.service';
import { FilesChecksumService } from '../../files/services/files-checksum.service';
import { FilesService } from '../../files/services/files.service';
import { StorageLifecycleEventsService } from '../../lib/platform-kafka';
import { OrganizationService } from '../../organizations/organization.service';
import { OrgLimitsService } from '../../organizations/services/org-limits.service';
import { OrgUsageService } from '../../organizations/services/org-usage.service';
import { ProcessorSchedulerService } from '../../processing/services/processor-scheduler.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { decodeMulterFilename } from '../utils/decode-multer-filename';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly checksumService: FilesChecksumService,
    private readonly storageFactory: StorageFactoryService,
    private readonly fileDuplicationService: FileDuplicationService,
    private readonly processorScheduler: ProcessorSchedulerService,
    private readonly organizations: OrganizationService,
    private readonly limitsService: OrgLimitsService,
    private readonly usageService: OrgUsageService,
    @Optional()
    private readonly lifecycleEvents?: StorageLifecycleEventsService,
  ) {}

  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    orgId: string,
    storageProviderId?: string,
    userId?: string,
    storageKeyOverride?: string,
    options?: { skipProcessing?: boolean },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const originalName = decodeMulterFilename(file.originalname);
    file = { ...file, originalname: originalName };
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }

    const org = await this.organizations.getById(orgId);
    if (!org) {
      throw new BadRequestException(`Unknown organization: ${orgId}`);
    }
    if (org.status !== 'active') {
      throw new ForbiddenException(
        `Organization is ${org.status}; uploads are disabled`,
      );
    }

    const buffer = file.buffer;
    const size = buffer.length;
    const mime = (file.mimetype || 'application/octet-stream').toLowerCase();

    await this.assertWithinLimits(orgId, size, mime, {
      usedBytes: Number(org.usedBytes ?? 0n),
      objectCount: org.objectCount ?? 0,
    });

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
      void this.lifecycleEvents?.fileUploaded({
        fileId: fileToReturn.id,
        orgId,
        fileName: fileToReturn.originalFilename,
        fileSize: Number(fileToReturn.size),
        mimeType: fileToReturn.mimeType,
        isDuplicate: true,
      });
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

    let provider;
    try {
      provider = await this.storageFactory.getProvider(providerConfig.id);
    } catch (error) {
      throw new BadRequestException(
        `Storage provider "${providerConfig.name}" (${providerConfig.type}) is not reachable: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    try {
      await provider.upload(key, buffer, file.mimetype);
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload to storage provider (${providerConfig.type}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const config = providerConfig.config as { bucket?: string };
    let fileRecord;
    let createdNewRow = false;
    try {
      const created = await this.filesService.createFile({
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
      fileRecord = created.file;
      createdNewRow = created.created;

      // Hash/key race recovery can return an existing row with a different key.
      if (!createdNewRow && fileRecord.key && fileRecord.key !== key) {
        try {
          await provider.delete(key);
        } catch (deleteError) {
          this.logger.warn(
            `Orphan cleanup after duplicate recovery failed for key=${key}: ${
              deleteError instanceof Error ? deleteError.message : deleteError
            }`,
          );
        }
      }

      if (createdNewRow) {
        await this.usageService.increment(orgId, buffer.length);
      }
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

    if (createdNewRow && !options?.skipProcessing) {
      void this.scheduleProcessingJobs(
        fileRecord.id,
        file.mimetype,
        orgId,
        file.originalname,
      );
    } else if (options?.skipProcessing) {
      this.logger.log(
        `Skipping processors for file ${fileRecord.id} (skipProcessing=true)`,
      );
    }

    void this.lifecycleEvents?.fileUploaded({
      fileId: fileRecord.id,
      orgId,
      fileName: fileRecord.originalFilename,
      fileSize: Number(fileRecord.size),
      mimeType: fileRecord.mimeType,
      isDuplicate: !createdNewRow,
    });

    return {
      id: fileRecord.id,
      originalFileName: fileRecord.originalFilename,
      mimeType: fileRecord.mimeType,
      size: Number(fileRecord.size),
      isDuplicate: !createdNewRow,
      message: createdNewRow
        ? 'File uploaded successfully.'
        : `File already exists in the system. Using existing file (ID: ${fileRecord.id}).`,
      uploadedToStorage: createdNewRow,
      storageKey: createdNewRow ? key : fileRecord.key,
      createdAt: fileRecord.createdAt,
    };
  }

  private async assertWithinLimits(
    orgId: string,
    size: number,
    mime: string,
    usage: { usedBytes: number; objectCount: number },
  ): Promise<void> {
    const limits = await this.limitsService.resolve(orgId);

    if (size > limits.maxFileSizeBytes) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `File size ${size} exceeds max ${limits.maxFileSizeBytes} bytes`,
        maxFileSizeBytes: limits.maxFileSizeBytes,
      });
    }

    if (
      limits.allowedMimeTypes.length > 0 &&
      !limits.allowedMimeTypes.includes(mime)
    ) {
      throw new UnsupportedMediaTypeException({
        code: 'MIME_NOT_ALLOWED',
        message: `MIME type "${mime}" is not allowed`,
        allowedMimeTypes: limits.allowedMimeTypes,
      });
    }

    if (
      limits.maxObjectCount != null &&
      usage.objectCount >= limits.maxObjectCount
    ) {
      throw new HttpException(
        {
          code: 'OBJECT_QUOTA_EXCEEDED',
          message: `Organization object count limit (${limits.maxObjectCount}) reached`,
          maxObjectCount: limits.maxObjectCount,
          objectCount: usage.objectCount,
        },
        HttpStatus.INSUFFICIENT_STORAGE,
      );
    }

    if (
      limits.storageQuotaBytes != null &&
      usage.usedBytes + size > limits.storageQuotaBytes
    ) {
      throw new HttpException(
        {
          code: 'STORAGE_QUOTA_EXCEEDED',
          message: `Upload would exceed storage quota (${limits.storageQuotaBytes} bytes)`,
          storageQuotaBytes: limits.storageQuotaBytes,
          usedBytes: usage.usedBytes,
          fileSize: size,
        },
        HttpStatus.INSUFFICIENT_STORAGE,
      );
    }
  }

  /**
   * Re-enqueue processing using current org_processors bindings.
   * Pass `onlyKeys` to target a subset (e.g. image normalize + variants).
   */
  async regenerateProcessing(
    fileId: string,
    orgId: string,
    onlyKeys?: string[],
  ): Promise<{ scheduled: string[] }> {
    const file = await this.filesService.findById(fileId, orgId);
    return this.scheduleProcessingJobs(
      file.id,
      file.mimeType,
      orgId,
      file.originalFilename ?? undefined,
      onlyKeys,
      true,
    );
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

  private async scheduleProcessingJobs(
    fileId: string,
    mimetype: string,
    orgId: string,
    originalFileName?: string,
    onlyKeys?: string[],
    throwOnError = false,
  ): Promise<{ scheduled: string[] }> {
    try {
      const result = await this.processorScheduler.scheduleForFile({
        fileId,
        orgId,
        mimeType: mimetype,
        originalFileName,
        onlyKeys,
      });
      if (result.scheduled.length > 0) {
        this.logger.log(
          `Scheduled processors for file ${fileId}: ${result.scheduled.join(', ')}`,
        );
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to schedule processing jobs for file ${fileId}:`,
        error instanceof Error ? error.stack : String(error),
      );
      if (throwOnError) throw error;
      return { scheduled: [] };
    }
  }
}
