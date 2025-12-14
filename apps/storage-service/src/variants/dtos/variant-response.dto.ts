import { VariantType } from '../repositories/variants.repository';

export class VariantResponseDto {
  id!: string;
  fileId!: string;
  variantType!: VariantType;
  variantKey!: string;
  storageProviderId!: number;
  size!: bigint;
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  createdAt!: Date;
}

