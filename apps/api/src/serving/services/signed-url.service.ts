import { Injectable } from '@nestjs/common';
import { FilesService } from '../../files/services/files.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

function resolveSignedUrlTtl(
  requested: number | undefined,
  providerConfig: unknown,
): number {
  if (
    typeof requested === 'number' &&
    Number.isFinite(requested) &&
    requested > 0
  ) {
    return Math.floor(requested);
  }

  const raw =
    providerConfig &&
    typeof providerConfig === 'object' &&
    'signedUrlExpiresIn' in providerConfig
      ? (providerConfig as { signedUrlExpiresIn?: unknown }).signedUrlExpiresIn
      : undefined;

  const fromProvider =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;

  if (Number.isFinite(fromProvider) && fromProvider > 0) {
    return Math.floor(fromProvider);
  }

  return DEFAULT_SIGNED_URL_TTL_SECONDS;
}

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
    expiresIn?: number,
  ) {
    const file = await this.filesService.findById(fileId);
    let variant = null;
    let provider;
    let key;
    let providerRow;

    if (variantType) {
      variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );

      if (!variant) {
        provider = await this.filesService.getFileProvider(fileId);
        key = file.key;
        providerRow = await this.storageFactory.getProviderConfig(
          file.storageProviderId,
        );
      } else {
        provider = await this.filesService.getFileProvider(fileId);
        key = variant.key;
        providerRow = await this.storageFactory.getProviderConfig(
          file.storageProviderId,
        );
      }
    } else {
      provider = await this.filesService.getFileProvider(fileId);
      key = file.key;
      providerRow = await this.storageFactory.getProviderConfig(
        file.storageProviderId,
      );
    }

    const ttl = resolveSignedUrlTtl(expiresIn, providerRow?.config);

    if (providerRow?.type === 'local') {
      const baseUrl =
        process.env.APP_URL || process.env.BASE_URL || 'http://localhost:6100';
      return {
        url: `${baseUrl}/v1/files/${fileId}/download${variantType ? `?variant=${variantType}` : ''}`,
        expiresIn: ttl,
      };
    }

    const url = await provider.getSignedUrl(key, ttl);
    return { url, expiresIn: ttl };
  }
}
