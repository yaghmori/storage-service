import { Injectable } from '@nestjs/common';
import { StorageProvidersRepository } from '../repositories/storage-providers.repository';

@Injectable()
export class StorageProvidersService {
  constructor(
    private readonly repository: StorageProvidersRepository,
  ) {}

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    return this.repository.findById(id);
  }

  async findActive() {
    return this.repository.findActive();
  }

  async create(data: {
    name: string;
    type: 's3' | 'minio' | 'local';
    config: any;
    isActive?: boolean;
  }) {
    return this.repository.create(data);
  }

  async update(id: number, data: Partial<{
    name: string;
    type: 's3' | 'minio' | 'local';
    config: any;
    isActive: boolean;
  }>) {
    return this.repository.update(id, data);
  }

  async delete(id: number) {
    return this.repository.delete(id);
  }
}

