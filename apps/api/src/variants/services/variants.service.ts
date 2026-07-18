import { Injectable } from '@nestjs/common';
import type { VariantResponse } from '../../lib/contracts';
import { VariantsRepository, VariantType } from '../repositories/variants.repository';
import { toVariantResponse } from '../variants.mapper';

@Injectable()
export class VariantsService {
  constructor(private readonly repository: VariantsRepository) {}

  async findByFileId(fileId: string): Promise<VariantResponse[]> {
    const variants = await this.repository.findByFileId(fileId);
    return variants.map(toVariantResponse);
  }

  async findByFileIdAndType(
    fileId: string,
    variantType: VariantType,
  ): Promise<VariantResponse | null> {
    const variant = await this.repository.findByFileIdAndType(fileId, variantType);
    return toVariantResponse(variant);
  }

  async findById(id: string): Promise<VariantResponse | null> {
    const variant = await this.repository.findById(id);
    return toVariantResponse(variant);
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
  }): Promise<VariantResponse> {
    const variant = await this.repository.create(data);
    return toVariantResponse(variant);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}

