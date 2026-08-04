import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import type { FileResponse } from '../../lib/contracts';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { StorageLifecycleEventsService } from '../../lib/platform-kafka';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { toFileResponse } from '../files.mapper';
import { FilesRepository } from '../repositories/files.repository';
import { FileDuplicationService } from './file-duplication.service';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly repository: FilesRepository,
    private readonly storageFactory: StorageFactoryService,
    private readonly duplicationService: FileDuplicationService,
    @Optional()
    private readonly lifecycleEvents?: StorageLifecycleEventsService,
  ) {}

  async findById(id: string, orgId?: string): Promise<FileResponse> {
    const file = await this.repository.findById(id, orgId);
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    return toFileResponse(file);
  }

  async findByHash(fileHash: string, orgId: string): Promise<FileResponse[]> {
    const files = await this.repository.findByHash(fileHash, orgId);
    return files.map(toFileResponse);
  }

  async createFile(data: {
    orgId: string;
    storageProviderId: string;
    storageKey: string;
    storageBucket?: string;
    fileName: string;
    originalFileName: string;
    fileExtension?: string;
    mimeType: string;
    size: bigint;
    fileHash: string;
    uploadedBy?: string;
    tags?: string;
  }): Promise<{ file: FileResponse; created: boolean }> {
    // Check for existing files with the same hash BEFORE inserting
    // The unique constraint on fileHash prevents inserting duplicates
    const existingFiles = await this.duplicationService.detectDuplicatesByHash(data.fileHash, data.orgId);

    if (existingFiles.length > 0) {
      // File with this hash already exists - this is a duplicate upload
      // Use the oldest file as the original
      const original = existingFiles.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];

      // Increment reference count of the original file
      const updated = await this.repository.incrementReferenceCount(original.id);
      this.logger.log(
        `Duplicate detected: File with hash ${data.fileHash} already exists. Using original file ${original.id}. Reference count: ${updated?.referenceCount}`,
      );
      return { file: toFileResponse(updated || original)!, created: false };
    }

    // No duplicate found, create new file record
    try {
      const newFile = await this.repository.create(data);
      return { file: toFileResponse(newFile)!, created: true };
    } catch (error) {
      // Concurrent uploads can race on org+hash or storage_key+provider uniques.
      if (!isUniqueViolation(error)) {
        throw error;
      }

      this.logger.warn(
        `Unique constraint race on createFile (hash=${data.fileHash}, key=${data.storageKey}). Recovering…`,
      );

      const byHash = await this.duplicationService.detectDuplicatesByHash(
        data.fileHash,
        data.orgId,
      );
      if (byHash.length > 0) {
        const original = byHash.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        )[0];
        const updated = await this.repository.incrementReferenceCount(original.id);
        return { file: toFileResponse(updated || original)!, created: false };
      }

      const byKey = await this.repository.findByKeyAndProvider(
        data.storageKey,
        data.storageProviderId,
      );
      if (byKey) {
        const updated = await this.repository.incrementReferenceCount(byKey.id);
        return { file: toFileResponse(updated || byKey)!, created: false };
      }

      throw error;
    }
  }

  /**
   * Force soft-delete for security quarantine (virus scan), ignoring reference count.
   * Serving paths already exclude soft-deleted rows.
   */
  async quarantineFile(id: string, reason?: string): Promise<void> {
    const fileRow = await this.repository.findById(id);
    if (!fileRow) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    if (fileRow.deletedAt) return;
    await this.repository.softDelete(id);
    if (reason) {
      await this.repository.update(id, {
        processingStatus: 'failed',
        processingError: reason,
      });
    }
    this.logger.warn(`Quarantined file ${id}${reason ? `: ${reason}` : ''}`);
    void this.lifecycleEvents?.fileDeleted({
      fileId: id,
      orgId: fileRow.orgId,
      hardDelete: false,
    });
  }

  async deleteFile(id: string, hardDelete = false, userId?: string): Promise<FileResponse> {
    const file = await this.findById(id);
    // Get raw file row for internal operations (need storageProviderId and storageKey)
    const fileRow = await this.repository.findById(id);
    if (!fileRow) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // Check if this user uploaded this file as a duplicate
    // If yes, we should remove their duplicate upload record and decrement reference count
    const userDuplicate = await this.duplicationService.getUserDuplicateUpload(id, userId);
    if (userDuplicate) {
      // User uploaded this as a duplicate - remove their upload record
      await this.duplicationService.removeDuplicateUpload(userDuplicate.id);

      // Decrement reference count
      const updatedRow = await this.repository.decrementReferenceCount(id);

      this.logger.log(
        `User ${userId} deleted their duplicate upload of file ${id}. Reference count: ${updatedRow?.referenceCount || file.referenceCount - 1}`,
      );

      // Only delete the file if reference count reaches 0
      if (updatedRow && updatedRow.referenceCount === 0) {
        if (hardDelete) {
          const provider = await this.storageFactory.getProvider(fileRow.storageProviderId);
          await provider.delete(fileRow.storageKey);
          await this.repository.delete(id);
          this.logger.log(`Hard deleted file ${id} (no more references)`);
          void this.lifecycleEvents?.fileDeleted({
            fileId: id,
            orgId: fileRow.orgId,
            hardDelete: true,
          });
          return file;
        } else {
          const softDeleted = await this.repository.softDelete(id);
          this.logger.log(`Soft deleted file ${id} (no more references)`);
          void this.lifecycleEvents?.fileDeleted({
            fileId: id,
            orgId: fileRow.orgId,
            hardDelete: false,
          });
          return softDeleted ? toFileResponse(softDeleted) : file;
        }
      }

      // File still has references, return updated file
      return updatedRow ? toFileResponse(updatedRow) : file;
    }

    // User is the original uploader or no user context provided
    // Decrement reference count
    const updatedRow = await this.repository.decrementReferenceCount(id);

    if (updatedRow && updatedRow.referenceCount === 0) {
      // No more references - safe to delete
      if (hardDelete) {
        const provider = await this.storageFactory.getProvider(fileRow.storageProviderId);
        await provider.delete(fileRow.storageKey);
        await this.repository.delete(id);
        this.logger.log(`Hard deleted file ${id}`);
        void this.lifecycleEvents?.fileDeleted({
          fileId: id,
          orgId: fileRow.orgId,
          hardDelete: true,
        });
        return file;
      } else {
        const softDeleted = await this.repository.softDelete(id);
        this.logger.log(`Soft deleted file ${id} (reference count: 0)`);
        void this.lifecycleEvents?.fileDeleted({
          fileId: id,
          orgId: fileRow.orgId,
          hardDelete: false,
        });
        return softDeleted ? toFileResponse(softDeleted) : file;
      }
    }

    // File still has references, return updated file
    return updatedRow ? toFileResponse(updatedRow) : file;
  }

  async getFileStream(id: string) {
    // Get raw file row for internal operations (need storageProviderId and storageKey)
    const fileRow = await this.repository.findById(id);
    if (!fileRow) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // If file is a duplicate, get the original file (single source of truth: fileDuplicates table)
    const originalFile = await this.duplicationService.getOriginalFile(id);
    const actualFile = originalFile || fileRow;

    const provider = await this.storageFactory.getProvider(actualFile.storageProviderId);
    return provider.download(actualFile.storageKey);
  }

  async getFileProvider(id: string): Promise<IStorageProvider> {
    // Get raw file row for internal operations (need storageProviderId)
    const fileRow = await this.repository.findById(id);
    if (!fileRow) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // If file is a duplicate, use original file's provider (single source of truth: fileDuplicates table)
    const originalFile = await this.duplicationService.getOriginalFile(id);
    const actualFile = originalFile || fileRow;

    return this.storageFactory.getProvider(actualFile.storageProviderId);
  }

  async updateFile(id: string, data: {
    width?: number;
    height?: number;
    duration?: number;
    perceptualHash?: string;
    processingStatus?:
      | 'pending'
      | 'processing'
      | 'completed'
      | 'failed'
      | 'cancelled'
      | 'partial'
      | 'skipped';
    processingError?: string | null;
    [key: string]: unknown;
  }): Promise<FileResponse | null> {
    const updated = await this.repository.update(id, data);
    return updated ? toFileResponse(updated) : null;
  }

  async incrementReferenceCount(id: string): Promise<FileResponse | null> {
    const updated = await this.repository.incrementReferenceCount(id);
    return updated ? toFileResponse(updated) : null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const walk = (value: unknown, depth = 0): boolean => {
    if (!value || depth > 4) return false;
    if (typeof value !== 'object') {
      return /unique|duplicate key|23505/i.test(String(value));
    }
    const rec = value as {
      code?: string;
      cause?: unknown;
      message?: string;
      detail?: string;
    };
    if (rec.code === '23505') return true;
    if (
      typeof rec.message === 'string' &&
      /unique|duplicate key|23505/i.test(rec.message)
    ) {
      return true;
    }
    if (
      typeof rec.detail === 'string' &&
      /unique|duplicate key|23505/i.test(rec.detail)
    ) {
      return true;
    }
    return walk(rec.cause, depth + 1);
  };
  return walk(error);
}


