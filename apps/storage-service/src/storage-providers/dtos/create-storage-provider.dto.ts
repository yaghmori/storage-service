import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import type { StorageProviderConfig, StorageProviderType } from '../types/storage-provider-config.types';

export class CreateStorageProviderDto {
  @IsString()
  name!: string;

  @IsString()
  type!: StorageProviderType;

  @IsObject()
  config!: StorageProviderConfig;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

