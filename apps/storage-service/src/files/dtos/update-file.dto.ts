import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @IsOptional()
  originalFilename?: string;

  @IsNumber()
  @IsOptional()
  referenceCount?: number;
}

