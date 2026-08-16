import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageConfig } from '../../config/storage.config';
import * as schema from '../../database/drizzle/schema';
import { FileDuplicationService } from '../../files/services/file-duplication.service';
import { FilesChecksumService } from '../../files/services/files-checksum.service';
import { FilesService } from '../../files/services/files.service';
import { StorageLifecycleEventsService } from '../../lib/platform-kafka';
import { OrganizationService } from '../../organizations/organization.service';
import { OrgLimitsService } from '../../organizations/services/org-limits.service';
import { OrgUsageService } from '../../organizations/services/org-usage.service';
import { ProcessorSchedulerService } from '../../processing/services/processor-scheduler.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';

export type DirectUploadInitiateInput = {
  filename: string;
  mimeType: string;
  size: number;
  storageProviderId?: string;
  storageKey?: string;
  skipProcessing?: boolean;
  /** Force multipart even below threshold. */
  multipart?: boolean;
};

export type DirectUploadCompleteInput = {
  fileId: string;
  sha256Hash: string;
  skipProcessing?: boolean;
  parts?: Array<{ partNumber: number; etag: string }>;
};

@Injectable()
export class DirectUploadService {
  private readonly logger = new Logger(DirectUploadService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly storageConfig: StorageConfig,
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

  async initiate(orgId: string, input: DirectUploadInitiateInput, userId?: string) {
    const org = await this.requireActiveOrg(orgId);
    const mime = (input.mimeType || 'application/octet-stream').toLowerCase();
    const size = Number(input.size);
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException('size must be a positive number');
    }
    if (!input.filename?.trim()) {
      throw new BadRequestException('filename is required');
    }

    await this.assertWithinDirectLimits(orgId, size, mime, {
      usedBytes: Number(org.usedBytes ?? 0n),
      objectCount: org.objectCount ?? 0,
    });

    const providerConfig = await this.storageFactory.getProviderConfig(
      input.storageProviderId,
      orgId,
    );
    if (!providerConfig) {
      throw new BadRequestException('No storage provider available');
    }
    if (providerConfig.orgId && providerConfig.orgId !== orgId) {
      throw new BadRequestException(
        'Storage provider does not belong to this organization',
      );
    }
    const provider = await this.storageFactory.getProvider(providerConfig.id);
    if (!provider.canPresignForBrowser()) {
      throw new BadRequestException(
        'Direct uploads require a browser-reachable object store (S3/R2). Use POST /upload for private MinIO or local disk.',
      );
    }
    if (!provider.getSignedUploadUrl && !provider.createMultipartUpload) {
      throw new BadRequestException(
        `Provider type "${providerConfig.type}" does not support direct uploads`,
      );
    }

    const key = this.buildStorageKey(input.filename, input.storageKey);
    const expiresIn = this.storageConfig.uploadUrlExpiresIn;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const useMultipart =
      input.multipart === true || size > this.storageConfig.multipartThreshold;

    let multipartUploadId: string | null = null;
    let partSize: number | null = null;
    let uploadUrl: string | null = null;
    let method: 'PUT' | 'MULTIPART' = 'PUT';

    if (useMultipart) {
      if (!provider.createMultipartUpload || !provider.getSignedUploadPartUrl) {
        throw new BadRequestException(
          'Multipart uploads are not supported by this storage provider',
        );
      }
      const created = await provider.createMultipartUpload(key, mime);
      multipartUploadId = created.uploadId;
      partSize = this.storageConfig.multipartPartSize;
      method = 'MULTIPART';
    } else {
      if (!provider.getSignedUploadUrl) {
        throw new BadRequestException(
          'Presigned PUT is not supported by this storage provider',
        );
      }
      uploadUrl = await provider.getSignedUploadUrl(key, expiresIn, mime);
    }

    const config = providerConfig.config as { bucket?: string };
    const [session] = await this.db
      .insert(schema.uploadSessions)
      .values({
        orgId,
        storageProviderId: providerConfig.id,
        storageKey: key,
        storageBucket: config.bucket ?? null,
        originalFilename: input.filename.trim(),
        mimeType: mime,
        declaredSize: BigInt(size),
        multipartUploadId,
        partSize,
        skipProcessing: Boolean(input.skipProcessing),
        uploadedBy: userId ?? null,
        status: 'pending',
        expiresAt,
      })
      .returning();

    if (!session) {
      throw new BadRequestException('Failed to create upload session');
    }

    const partCount =
      useMultipart && partSize
        ? Math.max(1, Math.ceil(size / partSize))
        : undefined;

    return {
      fileId: session.id,
      uploadUrl,
      key,
      expiresIn,
      method,
      headers: mime ? { 'Content-Type': mime } : undefined,
      uploadId: multipartUploadId ?? undefined,
      partSize: partSize ?? undefined,
      partCount,
    };
  }

  async getPartUrl(
    orgId: string,
    input: { fileId: string; partNumber: number },
  ) {
    const session = await this.requirePendingSession(input.fileId, orgId);
    if (!session.multipartUploadId) {
      throw new BadRequestException('Upload session is not multipart');
    }
    if (!Number.isInteger(input.partNumber) || input.partNumber < 1) {
      throw new BadRequestException('partNumber must be a positive integer');
    }

    const provider = await this.storageFactory.getProvider(
      session.storageProviderId,
    );
    if (!provider.getSignedUploadPartUrl) {
      throw new BadRequestException(
        'Provider does not support multipart part URLs',
      );
    }

    const expiresIn = this.storageConfig.uploadUrlExpiresIn;
    const uploadUrl = await provider.getSignedUploadPartUrl(
      session.storageKey,
      session.multipartUploadId,
      input.partNumber,
      expiresIn,
    );

    return {
      fileId: session.id,
      partNumber: input.partNumber,
      uploadUrl,
      expiresIn,
      method: 'PUT' as const,
    };
  }

  async complete(
    orgId: string,
    input: DirectUploadCompleteInput,
    userId?: string,
  ) {
    const session = await this.requirePendingSession(input.fileId, orgId);
    const sha256Hash = input.sha256Hash?.trim().toLowerCase();
    if (!sha256Hash || !/^[a-f0-9]{64}$/.test(sha256Hash)) {
      throw new BadRequestException('sha256Hash must be a 64-char hex digest');
    }

    const provider = await this.storageFactory.getProvider(
      session.storageProviderId,
    );

    if (session.multipartUploadId) {
      if (!input.parts?.length) {
        throw new BadRequestException(
          'parts are required to complete a multipart upload',
        );
      }
      if (!provider.completeMultipartUpload) {
        throw new BadRequestException(
          'Provider does not support multipart complete',
        );
      }
      await provider.completeMultipartUpload(
        session.storageKey,
        session.multipartUploadId,
        input.parts,
      );
    }

    const exists = await provider.exists(session.storageKey);
    if (!exists) {
      throw new BadRequestException(
        'Object not found in storage. Upload the bytes before calling complete.',
      );
    }

    let objectSize = Number(session.declaredSize);
    if (provider.stat) {
      try {
        const stat = await provider.stat(session.storageKey);
        objectSize = stat.size;
      } catch (error) {
        this.logger.warn(
          `stat failed for ${session.storageKey}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    if (objectSize !== Number(session.declaredSize)) {
      await this.safeDeleteObject(provider, session.storageKey);
      throw new BadRequestException(
        `Uploaded size ${objectSize} does not match declared size ${session.declaredSize}`,
      );
    }

    // Verify hash by streaming object to a temp file (avoids buffering large files in RAM).
    const verifiedHash = await this.hashStoredObject(
      provider,
      session.storageKey,
      session.id,
    );
    if (verifiedHash !== sha256Hash) {
      await this.safeDeleteObject(provider, session.storageKey);
      if (session.multipartUploadId && provider.abortMultipartUpload) {
        // already completed; ignore
      }
      throw new BadRequestException(
        `SHA-256 mismatch: expected ${sha256Hash}, got ${verifiedHash}`,
      );
    }

    const skipProcessing =
      input.skipProcessing === true || session.skipProcessing;

    // Duplicate by hash — reuse existing file, delete orphan object.
    const existingFiles = await this.filesService.findByHash(sha256Hash, orgId);
    if (existingFiles.length > 0) {
      const originalFile = existingFiles.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0]!;

      await this.safeDeleteObject(provider, session.storageKey);
      await this.markSession(session.id, 'completed');

      const updatedFile = await this.filesService.incrementReferenceCount(
        originalFile.id,
      );
      await this.fileDuplicationService.markAsDuplicate(
        originalFile.id,
        orgId,
        'sha256',
        undefined,
        userId,
      );

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

    const extension = extname(session.originalFilename);
    const fileName = basename(session.storageKey);
    let fileRecord;
    let createdNewRow = false;
    try {
      const created = await this.filesService.createFile({
        orgId,
        storageProviderId: session.storageProviderId,
        storageKey: session.storageKey,
        storageBucket: session.storageBucket ?? undefined,
        fileName,
        originalFileName: session.originalFilename,
        fileExtension: extension.replace('.', ''),
        mimeType: session.mimeType,
        size: BigInt(objectSize),
        fileHash: sha256Hash,
      });
      fileRecord = created.file;
      createdNewRow = created.created;

      if (!createdNewRow && fileRecord.key && fileRecord.key !== session.storageKey) {
        await this.safeDeleteObject(provider, session.storageKey);
      }

      if (createdNewRow) {
        await this.usageService.increment(orgId, objectSize);
      }
    } catch (error) {
      await this.safeDeleteObject(provider, session.storageKey);
      throw error;
    }

    await this.markSession(session.id, 'completed');

    if (!fileRecord?.id) {
      throw new BadRequestException('File record not found');
    }

    if (createdNewRow && !skipProcessing) {
      void this.scheduleProcessingJobs(
        fileRecord.id,
        session.mimeType,
        orgId,
        session.originalFilename,
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
      storageKey: createdNewRow ? session.storageKey : fileRecord.key,
      createdAt: fileRecord.createdAt,
    };
  }

  async abort(orgId: string, fileId: string) {
    const session = await this.requirePendingSession(fileId, orgId);
    const provider = await this.storageFactory.getProvider(
      session.storageProviderId,
    );

    if (session.multipartUploadId && provider.abortMultipartUpload) {
      try {
        await provider.abortMultipartUpload(
          session.storageKey,
          session.multipartUploadId,
        );
      } catch (error) {
        this.logger.warn(
          `abortMultipartUpload failed: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    } else {
      await this.safeDeleteObject(provider, session.storageKey);
    }

    await this.markSession(session.id, 'aborted');
    return { fileId: session.id, status: 'aborted' as const };
  }

  private async requireActiveOrg(orgId: string) {
    if (!orgId) throw new BadRequestException('orgId is required');
    const org = await this.organizations.getById(orgId);
    if (!org) throw new BadRequestException(`Unknown organization: ${orgId}`);
    if (org.status !== 'active') {
      throw new ForbiddenException(
        `Organization is ${org.status}; uploads are disabled`,
      );
    }
    return org;
  }

  private async requirePendingSession(fileId: string, orgId: string) {
    const [session] = await this.db
      .select()
      .from(schema.uploadSessions)
      .where(
        and(
          eq(schema.uploadSessions.id, fileId),
          eq(schema.uploadSessions.orgId, orgId),
        ),
      )
      .limit(1);

    if (!session) {
      throw new NotFoundException(`Upload session ${fileId} not found`);
    }
    if (session.status !== 'pending') {
      throw new BadRequestException(
        `Upload session is ${session.status}, expected pending`,
      );
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.markSession(session.id, 'expired');
      throw new BadRequestException('Upload session has expired');
    }
    return session;
  }

  private async markSession(
    id: string,
    status: 'completed' | 'aborted' | 'expired',
  ) {
    await this.db
      .update(schema.uploadSessions)
      .set({
        status,
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(schema.uploadSessions.id, id));
  }

  private async assertWithinDirectLimits(
    orgId: string,
    size: number,
    mime: string,
    usage: { usedBytes: number; objectCount: number },
  ) {
    const limits = await this.limitsService.resolveForDirectUpload(orgId);

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

  private buildStorageKey(filename: string, storageKeyOverride?: string) {
    if (storageKeyOverride?.trim()) {
      const normalized = storageKeyOverride.trim().replace(/^\/+/, '');
      if (!normalized || normalized.includes('..') || normalized.includes('\\')) {
        throw new BadRequestException('Invalid storage key');
      }
      if (!/^[a-zA-Z0-9_./-]+$/.test(normalized)) {
        throw new BadRequestException('Invalid storage key characters');
      }
      return normalized;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const extension = extname(filename);
    return `${year}/${month}/${day}/${uuidv4()}${extension}`;
  }

  private async hashStoredObject(
    provider: Awaited<ReturnType<StorageFactoryService['getProvider']>>,
    key: string,
    sessionId: string,
  ): Promise<string> {
    const tempPath = join(tmpdir(), `direct_upload_${sessionId}_${Date.now()}`);
    try {
      await provider.downloadToFile(key, tempPath);
      return await this.checksumService.calculateSHA256Stream(
        createReadStream(tempPath),
      );
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  private async safeDeleteObject(
    provider: Awaited<ReturnType<StorageFactoryService['getProvider']>>,
    key: string,
  ) {
    try {
      await provider.delete(key);
    } catch (error) {
      this.logger.warn(
        `Failed to delete object ${key}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async scheduleProcessingJobs(
    fileId: string,
    mimetype: string,
    orgId: string,
    originalFileName?: string,
  ) {
    try {
      const result = await this.processorScheduler.scheduleForFile({
        fileId,
        orgId,
        mimeType: mimetype,
        originalFileName,
      });
      if (result.scheduled.length > 0) {
        this.logger.log(
          `Scheduled processors for file ${fileId}: ${result.scheduled.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule processing jobs for file ${fileId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
