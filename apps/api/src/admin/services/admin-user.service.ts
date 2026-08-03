import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';

@Injectable()
export class AdminUserService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByEmail(email: string): Promise<schema.AdminUser | null> {
    const normalized = email.trim().toLowerCase();
    const [user] = await this.db
      .select()
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.email, normalized))
      .limit(1);

    return user || null;
  }

  async findById(id: string): Promise<schema.AdminUser | null> {
    const [user] = await this.db
      .select()
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, id))
      .limit(1);

    return user || null;
  }

  async list(): Promise<schema.AdminUser[]> {
    return this.db.select().from(schema.adminUsers);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.adminUsers)
      .where(eq(schema.adminUsers.id, id))
      .returning();
    return result.length > 0;
  }

  async create(data: {
    email: string;
    password: string;
    role?: string;
  }): Promise<schema.AdminUser> {
    const passwordHash = await bcrypt.hash(data.password, 10);

    const [user] = await this.db
      .insert(schema.adminUsers)
      .values({
        email: data.email.trim().toLowerCase(),
        passwordHash,
        role: data.role || 'admin',
        isActive: true,
      } as typeof schema.adminUsers.$inferInsert)
      .returning();

    return user;
  }

  async verifyPassword(user: schema.AdminUser, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(schema.adminUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() } as Partial<typeof schema.adminUsers.$inferInsert>)
      .where(eq(schema.adminUsers.id, id));
  }

  async update(id: string, data: Partial<{
    email: string;
    password: string;
    role: string;
    isActive: boolean;
  }>): Promise<schema.AdminUser | null> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) {
      updateData.email = data.email.trim().toLowerCase();
    }
    if (data.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    if (data.role !== undefined) {
      updateData.role = data.role;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const [user] = await this.db
      .update(schema.adminUsers)
      .set(updateData)
      .where(eq(schema.adminUsers.id, id))
      .returning();

    return user || null;
  }
}
