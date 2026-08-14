import { Injectable } from '@nestjs/common';
import { StorageConfig } from '../../config/storage.config';
import { FilesService } from '../../files/services/files.service';
import { StorageFactoryService } from '../../storage-providers/services/storage-factory.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';
import {
  assertFilesSigningSecret,
  signFileDownload,
} from '../utils/file-download-hmac';

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
    private readonly storageConfig: StorageConfig,
  ) {}

  async generateSignedUrl(
    fileId: string,
    variantType?: VariantType,
    expiresIn?: number,
  ) {
    const file = await this.filesService.findById(fileId);
    const providerRow = await this.storageFactory.getProviderConfig(
      file.storageProviderId,
    );
    const ttl = resolveSignedUrlTtl(expiresIn, providerRow?.config);
    const secret = assertFilesSigningSecret();
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = signFileDownload(
      { fileId, exp, variant: variantType },
      secret,
    );

    const base =
      this.storageConfig.filesPublicBaseUrl ||
      'http://localhost:6100';
    const params = new URLSearchParams();
    params.set('exp', String(exp));
    params.set('sig', sig);
    if (variantType) {
      params.set('variant', variantType);
    }

    return {
      url: `${base}/v1/files/${fileId}/download?${params.toString()}`,
      expiresIn: ttl,
    };
  }

  async resolveDownloadTarget(fileId: string, variantType?: VariantType) {
    const file = await this.filesService.findById(fileId);
    let key = file.key;

    if (variantType) {
      const variant = await this.variantsService.findByFileIdAndType(
        fileId,
        variantType,
      );
      if (variant) {
        key = variant.key;
      }
    }

    const provider = await this.filesService.getFileProvider(fileId);
    return { file, key, provider };
  }
}
