import { Injectable, BadRequestException } from '@nestjs/common';
import { FilesService } from '../files/services/files.service';
import { FilesChecksumService } from '../files/services/files-checksum.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { QueuesService } from '../../queues/queues.service';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@Injectable()
export class UploadService {
  constructor(
    private readonly filesService: FilesService,
    private readonly checksumService: FilesChecksumService,
    private readonly storageFactory: StorageFactoryService,
    private readonly queuesService: QueuesService,
  ) {}

  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    storageProviderId?: number,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Calculate checksum
    const buffer = file.buffer;
    const sha256Hash = await this.checksumService.calculateSHA256(buffer);

    // Check for duplicates
    const duplicates = await this.filesService.findByHash(sha256Hash);
    if (duplicates.length > 0) {
      const existing = duplicates[0];
      // Increment reference count will be handled by createFile if duplicate exists
      return existing;
    }

    // Get provider config first
    const providerConfig = await this.storageFactory.getProviderConfig(storageProviderId);
    if (!providerConfig) {
      throw new BadRequestException('No storage provider available');
    }

    // Get storage provider instance
    const provider = await this.storageFactory.getProvider(providerConfig.id);

    // Generate unique key
    const extension = extname(file.originalname);
    const key = `${uuidv4()}${extension}`;

    // Upload to storage
    await provider.upload(key, buffer, file.mimetype);

    // Extract file extension
    const extension = extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;

    // Create file record
    const fileRecord = await this.filesService.createFile({
      storageProviderId: providerConfig.id,
      storageKey: key,
      storageBucket: providerConfig.config?.bucket,
      fileName,
      originalFileName: file.originalname,
      fileExtension: extension.replace('.', ''),
      mimeType: file.mimetype,
      size: BigInt(buffer.length),
      fileHash: sha256Hash,
    });

    // Add processing jobs based on file type
    if (file.mimetype.startsWith('image/')) {
      await this.queuesService.addImageProcessingJob({
        fileId: fileRecord.id,
        options: {
          sizes: [100, 200, 500, 1000],
          formats: ['webp', 'avif'],
        },
      });
    } else if (file.mimetype.startsWith('video/')) {
      await this.queuesService.addVideoProcessingJob({
        fileId: fileRecord.id,
        options: {
          previewFrames: 5,
          thumbnail: true,
        },
      });
    }

    // Always extract metadata
    await this.queuesService.addMetadataExtractionJob({
      fileId: fileRecord.id,
    });

    return fileRecord;
  }
}

