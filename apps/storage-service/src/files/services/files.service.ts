import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IStorageProvider } from '../../common/interfaces/storage-provider.interface';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { FilesRepository } from '../repositories/files.repository';
import { FileDuplicationService } from './file-duplication.service';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly repository: FilesRepository,
    private readonly storageFactory: StorageFactoryService,
    private readonly duplicationService: FileDuplicationService,
  ) {}

  async findById(id: string) {
    const file = await this.repository.findById(id);
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    return file;
  }

  async findByHash(fileHash: string) {
    return this.repository.findByHash(fileHash);
  }

  async createFile(data: {
    storageProviderId: number;
    storageKey: string;
    storageBucket?: string;
    fileName: string;
    originalFileName: string;
    fileExtension?: string;
    mimeType: string;
    size: bigint;
    fileHash: string;
    checksum?: string;
    uploadedBy?: number;
    tags?: string;
  }) {
    // Check for existing files with the same hash BEFORE inserting
    // The unique constraint on fileHash prevents inserting duplicates
    const existingFiles = await this.duplicationService.detectDuplicatesByHash(data.fileHash);

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
      return updated || original;
    }

    // No duplicate found, create new file record
    // This will succeed because no file with this hash exists
    try {
      const newFile = await this.repository.create(data);
      return newFile;
    } catch (error) {
      // Handle race condition: if another request inserted the same file between our check and insert
      if (error instanceof Error && error.message.includes('unique') && error.message.includes('file_hash')) {
        this.logger.warn(
          `Race condition detected: File with hash ${data.fileHash} was inserted by another process. Retrying...`,
        );
        // Retry: find the existing file
        const existingFiles = await this.duplicationService.detectDuplicatesByHash(data.fileHash);
        if (existingFiles.length > 0) {
          const original = existingFiles.sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          )[0];
          const updated = await this.repository.incrementReferenceCount(original.id);
          return updated || original;
        }
      }
      // Re-throw if it's not a unique constraint violation
      throw error;
    }
  }

  async deleteFile(id: string, hardDelete = false) {
    const file = await this.findById(id);

    // Check if it's a duplicate (single source of truth: fileDuplicates table)
    const isDuplicate = await this.duplicationService.isDuplicate(id);
    if (isDuplicate) {
      // For duplicates, just decrement reference count
      const updated = await this.repository.decrementReferenceCount(id);

      if (updated && updated.referenceCount === 0) {
        // Soft delete the duplicate
        await this.repository.softDelete(id);
        this.logger.log(`Soft deleted duplicate file ${id}`);
        return { deleted: true, type: 'soft' };
      }

      return { deleted: false, referenceCount: updated?.referenceCount };
    }

    // For original files, use standard deletion strategy
    const updated = await this.repository.decrementReferenceCount(id);

    if (updated && updated.referenceCount === 0) {
      if (hardDelete) {
        // Hard delete immediately
        const provider = await this.storageFactory.getProvider(file.storageProviderId);
        await provider.delete(file.storageKey);
        await this.repository.delete(id);
        this.logger.log(`Hard deleted file ${id}`);
        return { deleted: true, type: 'hard' };
      } else {
        // Soft delete (recommended)
        await this.repository.softDelete(id);
        this.logger.log(`Soft deleted file ${id} (reference count: 0)`);
        return { deleted: true, type: 'soft' };
      }
    }

    return { deleted: false, referenceCount: updated?.referenceCount };
  }

  async getFileStream(id: string) {
    const file = await this.findById(id);

    // If file is a duplicate, get the original file (single source of truth: fileDuplicates table)
    const originalFile = await this.duplicationService.getOriginalFile(id);
    const actualFile = originalFile || file;

    const provider = await this.storageFactory.getProvider(actualFile.storageProviderId);
    return provider.download(actualFile.storageKey);
  }

  async getFileProvider(id: string): Promise<IStorageProvider> {
    const file = await this.findById(id);

    // If file is a duplicate, use original file's provider (single source of truth: fileDuplicates table)
    const originalFile = await this.duplicationService.getOriginalFile(id);
    const actualFile = originalFile || file;

    return this.storageFactory.getProvider(actualFile.storageProviderId);
  }

  async updateFile(id: string, data: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    isProcessed?: boolean;
    processingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    [key: string]: unknown;
  }) {
    return this.repository.update(id, data);
  }

  async incrementReferenceCount(id: string) {
    return this.repository.incrementReferenceCount(id);
  }
}

