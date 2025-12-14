import { Injectable } from '@nestjs/common';
import { VariantsRepository, VariantType } from '../repositories/variants.repository';

@Injectable()
export class VariantsService {
  constructor(private readonly repository: VariantsRepository) {}

  async findByFileId(fileId: string) {
    return this.repository.findByFileId(fileId);
  }

  async findByFileIdAndType(fileId: string, variantType: VariantType) {
    return this.repository.findByFileIdAndType(fileId, variantType);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async create(data: {
    fileId: string;
    variantType: VariantType;
    variantKey: string;
    storageProviderId: string;
    size: bigint;
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  }) {
    return this.repository.create(data);
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }
}

