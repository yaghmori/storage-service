import { Injectable } from '@nestjs/common';
import { FilesService } from '../../files/services/files.service';
import { VariantsService } from '../../variants/variants.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';

@Injectable()
export class SignedUrlService {
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly storageFactory: StorageFactoryService,
  ) {}

  async generateSignedUrl(
    fileId: string,
    variantType?: string,
    expiresIn: number = 3600,
  ) {
    let file;
    let variant = null;
    let provider;
    let key;

    // Get file first
    file = await this.filesService.findById(fileId);

    if (variantType) {
      // Query variants table - single source of truth
      let variants = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );
      if (!variants || variants.length === 0) {
        // Fallback to original if variant not found
        provider = await this.filesService.getFileProvider(fileId);
        key = file.storageKey;
      } else {
        variant = variants[0];
        provider = await this.storageFactory.getProvider(variant.storageProviderId);
        key = variant.variantKey;
      }
    } else {
      // Serve original file
      provider = await this.filesService.getFileProvider(fileId);
      key = file.storageKey;
    }

    return provider.getSignedUrl(key, expiresIn);
  }
}

