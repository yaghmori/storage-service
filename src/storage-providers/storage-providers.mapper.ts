import type { StorageProviderResponse } from '@platform/messaging-contracts';
import type { storageProviders } from '../database/drizzle/schema';

type StorageProviderRow = typeof storageProviders.$inferSelect;

/**
 * Maps a Drizzle storageProviders table row to StorageProviderResponse contract type
 */
export function toStorageProviderResponse(
  row: StorageProviderRow | null,
): StorageProviderResponse | null {
  if (!row) return null;

  // Map database enum values to contract enum values
  // DB: 's3', 'minio', 'local'
  // Contract: 'local', 's3', 'gcs', 'azure', 'cloudinary'
  const mapType = (dbType: string): StorageProviderResponse['type'] => {
    if (dbType === 'minio') {
      return 's3'; // minio is S3-compatible
    }
    return dbType as StorageProviderResponse['type'];
  };

  return {
    id: row.id,
    name: row.name,
    type: mapType(row.type),
    config: row.config as StorageProviderResponse['config'],
    isActive: row.isActive,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
