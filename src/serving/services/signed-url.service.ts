import { Injectable } from '@nestjs/common';
import { FilesService } from '../../files/services/files.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';

@Injectable()
export class SignedUrlService {
  constructor(
    private readonly filesService: FilesService,
    private readonly variantsService: VariantsService,
    private readonly storageFactory: StorageFactoryService,
  ) {}

  async generateSignedUrl(
    fileId: string,
    variantType?: VariantType,
    expiresIn = 3600,
  ) {
    const file = await this.filesService.findById(fileId);
    let variant = null;
    let provider;
    let key;
    let providerConfig;

    // Get file first

    if (variantType) {
      // Query variants table - single source of truth
      variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );
      if (!variant) {
        // Fallback to original if variant not found
        provider = await this.filesService.getFileProvider(fileId);
        providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);
        key = file.key;
      } else {
        // Use file's provider since variants are typically stored in the same provider
        provider = await this.filesService.getFileProvider(fileId);
        providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);
        key = variant.key;
      }
    } else {
      // Serve original file
      provider = await this.filesService.getFileProvider(fileId);
      providerConfig = await this.storageFactory.getProviderConfig(file.storageProviderId);
      key = file.key;
    }

    // For local storage, return a proper download URL using file ID
    if (providerConfig?.type === 'local') {
      const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:4000';
      const variantParam = variantType ? `?variant=${variantType}` : '';
      return `${baseUrl}/api/files/${fileId}/download${variantParam}`;
    }

    return provider.getSignedUrl(key, expiresIn);
  }
}

