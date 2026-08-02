import {
  BadRequestException,
  Body,
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
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { and, count, desc, eq, ilike, isNotNull, isNull, or, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { toJsonSafe } from '../../common/utils/json-safe.util';
import * as schema from '../../database/drizzle/schema';
import { FileDeletionService } from '../../files/services/file-deletion.service';
import { emptySuccess } from '../../lib/contracts';
import { SkipResponseTransform } from '../../lib/contracts/nest';
import { SignedUrlService } from '../../serving/services/signed-url.service';
import { ServingService } from '../../serving/services/serving.service';
import { platformMulterFileLimits } from '../../upload/multer-limits';
import { UploadService } from '../../upload/services/upload.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';
import {
  CurrentAdmin,
  type AdminRequestUser,
} from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { requireOrgId } from '../utils/require-org-id';

class ListFilesQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  deletedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Public()
@Controller('admin/api/files')
@UseGuards(AdminAuthGuard)
export class FilesController {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly uploadService: UploadService,
    private readonly signedUrlService: SignedUrlService,
    private readonly servingService: ServingService,
    private readonly fileDeletionService: FileDeletionService,
    private readonly variantsService: VariantsService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: platformMulterFileLimits() }))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('storageProviderId') storageProviderId?: string,
    @Body('storageKey') storageKey?: string,
    @Body('orgId') bodyOrgId?: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
    @CurrentAdmin() admin?: AdminRequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const orgId = requireOrgId(queryOrgId || bodyOrgId, headerOrgId);
    return this.uploadService.uploadFile(
      file,
      orgId,
      storageProviderId?.trim() || undefined,
      admin?.adminId,
      storageKey?.trim() || undefined,
    );
  }

  @Get()
  async listFiles(
    @Query() query: ListFilesQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(schema.files.orgId, orgId)];

    if (query.deletedOnly) {
      conditions.push(isNotNull(schema.files.deletedAt));
    } else if (!query.includeDeleted) {
      conditions.push(isNull(schema.files.deletedAt));
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.files.originalFileName, term),
          ilike(schema.files.mimeType, term),
        )!,
      );
    }

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schema.files)
        .where(where)
        .orderBy(desc(schema.files.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(schema.files).where(where),
    ]);

    return {
      items: rows.map((row) => toJsonSafe(row)),
      total: Number(totalResult[0]?.total ?? 0),
      page,
      limit,
    };
  }

  @Get(':id/signed-url')
  async getSignedUrl(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Query('variant') variant?: string,
    @Query('expiresIn') expiresIn?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const file = await this.findOrgFile(id, orgId);

    let variantType = variant?.trim() as VariantType | undefined;
    if (!variantType && file.mimeType?.startsWith('image/')) {
      variantType = 'thumbnail';
    }

    const requested = expiresIn ? parseInt(expiresIn, 10) : undefined;
    const result = await this.signedUrlService.generateSignedUrl(
      id,
      variantType,
      Number.isFinite(requested) ? requested : undefined,
    );

    return {
      url: result.url,
      expiresIn: result.expiresIn,
      fileId: file.id,
      variant: variantType ?? null,
    };
  }

  @Get(':id/metadata')
  async getFileMetadata(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);

    const [row] = await this.db
      .select({
        id: schema.fileMetadata.id,
        fileId: schema.fileMetadata.fileId,
        metadata: schema.fileMetadata.metadata,
        extractedAt: schema.fileMetadata.extractedAt,
        updatedAt: schema.fileMetadata.updatedAt,
      })
      .from(schema.fileMetadata)
      .where(eq(schema.fileMetadata.fileId, id))
      .limit(1);

    if (!row) {
      return {
        fileId: id,
        metadata: null,
        extractedAt: null,
        updatedAt: null,
      };
    }

    return toJsonSafe(row);
  }

  @Get(':id/variants')
  async listVariants(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);
    const variants = await this.variantsService.findByFileId(id);
    return { items: variants, total: variants.length };
  }

  @Post(':id/regenerate-processing')
  @HttpCode(HttpStatus.OK)
  async regenerateProcessing(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);
    const result = await this.uploadService.regenerateProcessing(id, orgId);
    return {
      fileId: id,
      scheduled: result.scheduled,
      message:
        result.scheduled.length > 0
          ? `Scheduled: ${result.scheduled.join(', ')}`
          : 'No processing jobs scheduled (disabled by org settings or unsupported type)',
    };
  }

  @Get(':id/content')
  @SkipResponseTransform()
  async streamContent(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Query('variant') variant?: string,
    @Query('download') download?: string,
    @Headers('x-org-id') headerOrgId?: string,
    @Req() request?: Request,
    @Res() response?: Response,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);

    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;

    const forwardedFor = request?.headers['x-forwarded-for'];
    const ipAddress = forwardedFor
      ? Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0]
      : undefined;

    const asDownload =
      download === '1' || download === 'true' || download === 'attachment';

    await this.servingService.streamFile(
      id,
      variantType,
      undefined,
      response,
      ipAddress,
      request?.headers['user-agent'],
      asDownload,
    );
  }

  @Get(':id')
  async getFile(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.findOrgFile(id, orgId);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.OK)
  async hardDeleteFile(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId, true);

    // force=true: remove object + variants from storage even if still referenced
    await this.fileDeletionService.hardDelete(id, true);

    return emptySuccess({
      message: 'File permanently deleted from database and storage',
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async softDeleteFile(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);

    const [updated] = await this.db
      .update(schema.files)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.files.id, id), eq(schema.files.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new NotFoundException(`File with id ${id} not found`);
    }

    return emptySuccess({
      message:
        'File soft-deleted (hidden from lists; object remains in storage)',
    });
  }

  private async findOrgFile(id: string, orgId: string, includeDeleted = false) {
    const conditions: SQL[] = [
      eq(schema.files.id, id),
      eq(schema.files.orgId, orgId),
    ];
    if (!includeDeleted) {
      conditions.push(isNull(schema.files.deletedAt));
    }

    const [file] = await this.db
      .select()
      .from(schema.files)
      .where(and(...conditions))
      .limit(1);

    if (!file) {
      throw new NotFoundException(`File with id ${id} not found`);
    }

    return toJsonSafe(file);
  }
}
