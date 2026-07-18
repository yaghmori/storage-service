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

    if (variantType) {
      variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );

      if (!variant) {
        provider = await this.filesService.getFileProvider(fileId);
        key = file.key;
        providerConfig = await this.storageFactory.getProviderConfig(
          file.storageProviderId,
        );
      } else {
        provider = await this.filesService.getFileProvider(fileId);
        key = variant.key;
        providerConfig = await this.storageFactory.getProviderConfig(
          file.storageProviderId,
        );
      }
    } else {
      provider = await this.filesService.getFileProvider(fileId);
      key = file.key;
      providerConfig = await this.storageFactory.getProviderConfig(
        file.storageProviderId,
      );
    }

    if (providerConfig?.type === 'local') {
      const baseUrl =
        process.env.APP_URL || process.env.BASE_URL || 'http://localhost:6100';
      return `${baseUrl}/api/files/${fileId}/download${variantType ? `?variant=${variantType}` : ''}`;
    }

    return provider.getSignedUrl(key, expiresIn);
  }
}
