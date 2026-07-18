import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import * as schema from '../../database/drizzle/schema';
import { emptySuccess } from '../../lib/contracts';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { requireOrgId } from '../utils/require-org-id';

const PROVIDER_TYPES = ['s3', 'minio', 'local'] as const;

export class CreateProviderDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(PROVIDER_TYPES)
  type!: (typeof PROVIDER_TYPES)[number];

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  orgId?: string;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(PROVIDER_TYPES)
  type?: (typeof PROVIDER_TYPES)[number];

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@Public()
@Controller('admin/api/providers')
@UseGuards(AdminAuthGuard)
export class ProvidersController {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get()
  async listProviders(
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.db
      .select()
      .from(schema.storageProviders)
      .where(eq(schema.storageProviders.orgId, orgId))
      .orderBy(desc(schema.storageProviders.createdAt));
  }

  @Get(':id')
  async getProvider(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.findOrgProvider(id, orgId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProvider(
    @Body() dto: CreateProviderDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(dto.orgId || queryOrgId, headerOrgId);
    const name = dto.name.trim();

    const existing = await this.db
      .select({ id: schema.storageProviders.id })
      .from(schema.storageProviders)
      .where(
        and(
          eq(schema.storageProviders.orgId, orgId),
          eq(schema.storageProviders.name, name),
        ),
      )
      .limit(1);

    if (existing[0]) {
      throw new ConflictException(`Provider name "${name}" already exists in this organization`);
    }

    const isDefault = dto.isDefault ?? false;

    return this.db.transaction(async (tx) => {
      if (isDefault) {
        await tx
          .update(schema.storageProviders)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(schema.storageProviders.orgId, orgId));
      }

      const [created] = await tx
        .insert(schema.storageProviders)
        .values({
          orgId,
          name,
          type: dto.type,
          config: dto.config,
          isActive: dto.isActive ?? true,
          isDefault,
        })
        .returning();

      return created;
    });
  }

  @Put(':id')
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgProvider(id, orgId);

    if (dto.name?.trim()) {
      const name = dto.name.trim();
      const conflict = await this.db
        .select({ id: schema.storageProviders.id })
        .from(schema.storageProviders)
        .where(
          and(
            eq(schema.storageProviders.orgId, orgId),
            eq(schema.storageProviders.name, name),
          ),
        )
        .limit(1);

      if (conflict[0] && conflict[0].id !== id) {
        throw new ConflictException(`Provider name "${name}" already exists in this organization`);
      }
    }

    return this.db.transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx
          .update(schema.storageProviders)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(schema.storageProviders.orgId, orgId));
      }

      const [updated] = await tx
        .update(schema.storageProviders)
        .set({
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.config !== undefined ? { config: dto.config } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.storageProviders.id, id),
            eq(schema.storageProviders.orgId, orgId),
          ),
        )
        .returning();

      if (!updated) {
        throw new NotFoundException(`Provider with id ${id} not found`);
      }

      return updated;
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteProvider(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgProvider(id, orgId);

    await this.db
      .delete(schema.storageProviders)
      .where(
        and(
          eq(schema.storageProviders.id, id),
          eq(schema.storageProviders.orgId, orgId),
        ),
      );

    return emptySuccess({ message: 'Provider deleted' });
  }

  @Post(':id/test')
  async testProvider(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const provider = await this.findOrgProvider(id, orgId);

    if (!provider.isActive) {
      throw new BadRequestException('Provider is inactive');
    }

    return { ok: true, type: provider.type };
  }

  private async findOrgProvider(id: string, orgId: string) {
    const [provider] = await this.db
      .select()
      .from(schema.storageProviders)
      .where(
        and(
          eq(schema.storageProviders.id, id),
          eq(schema.storageProviders.orgId, orgId),
        ),
      )
      .limit(1);

    if (!provider) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return provider;
  }
}
