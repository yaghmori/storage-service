import { IsString, IsObject, IsBoolean, IsOptional } from 'class-validator';

export class CreateStorageProviderDto {
  @IsString()
  name: string;

  @IsString()
  type: 's3' | 'minio' | 'local';

  @IsObject()
  config: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

