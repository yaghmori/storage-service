
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/schema';
import { StorageProviderConfig, StorageProviderType } from '../types/storage-provider-config.types';

@Injectable()
export class StorageProvidersRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll() {
    return this.db.select().from(schema.storageProviders);
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(schema.storageProviders)
      .where(eq(schema.storageProviders.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findActive() {
    return this.db
      .select()
      .from(schema.storageProviders)
      .where(eq(schema.storageProviders.isActive, true));
  }

  async findDefault() {
    const result = await this.db
      .select()
      .from(schema.storageProviders)
      .where(
        and(
          eq(schema.storageProviders.isActive, true),
          eq(schema.storageProviders.isDefault, true),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async findByType(type: StorageProviderType) {
    return this.db
      .select()
      .from(schema.storageProviders)
      .where(
        and(
          eq(schema.storageProviders.type, type),
          eq(schema.storageProviders.isActive, true),
        ),
      );
  }

  async create(data: {
    name: string;
    type: StorageProviderType;
    config: StorageProviderConfig;
    isActive?: boolean;
    isDefault?: boolean;
  }) {
    const result = await this.db
      .insert(schema.storageProviders)
      .values({
        name: data.name,
        type: data.type,
        config: data.config,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
      })
      .returning();
    return result[0];
  }

  async update(id: string, data: Partial<typeof schema.storageProviders.$inferInsert>) {
    const result = await this.db
      .update(schema.storageProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.storageProviders.id, id))
      .returning();
    return result[0] || null;
  }

  async delete(id: string) {
    await this.db
      .delete(schema.storageProviders)
      .where(eq(schema.storageProviders.id, id));
  }
}

