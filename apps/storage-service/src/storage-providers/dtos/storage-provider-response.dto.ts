import { StorageProviderConfig, StorageProviderType } from "../types/storage-provider-config.types";

export class StorageProviderResponseDto {
  id!: string;
  name!: string;
  type!: StorageProviderType;
  config!: StorageProviderConfig;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

