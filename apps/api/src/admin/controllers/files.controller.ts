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
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  like,
  lte,
  not,
  or,
  SQL,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProcessorKey } from '@workspace/validation';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { toJsonSafe } from '../../common/utils/json-safe.util';
import * as schema from '../../database/drizzle/schema';
import { FileDeletionService } from '../../files/services/file-deletion.service';
import { FileDuplicationService } from '../../files/services/file-duplication.service';
import { emptySuccess } from '../../lib/contracts';
import { SkipResponseTransform } from '../../lib/contracts/nest';
import { QueuesService } from '../../queues/queues.service';
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

/** MIME families aligned with org usage breakdown. */
const FILE_TYPE_FILTERS = [
  'images',
  'videos',
  'audio',
  'documents',
  'other',
] as const;

type FileTypeFilter = (typeof FILE_TYPE_FILTERS)[number];

const PROCESSING_STATUS_FILTERS = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'partial',
  'skipped',
] as const;

type ProcessingStatusFilter = (typeof PROCESSING_STATUS_FILTERS)[number];

class ListFilesQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by MIME family: images | videos | audio | documents | other */
  @IsOptional()
  @IsIn(FILE_TYPE_FILTERS)
  fileType?: FileTypeFilter;

  @IsOptional()
  @IsIn(PROCESSING_STATUS_FILTERS)
  processingStatus?: ProcessingStatusFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSize?: number;

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
    private readonly fileDuplicationService: FileDuplicationService,
    private readonly variantsService: VariantsService,
    private readonly queuesService: QueuesService,
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
    // Query params arrive as strings — ValidationPipe returns the plain payload
    // after validating a transformed copy, so coerce before limit/offset.
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
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

    if (query.fileType) {
      const mimeTypeCondition = this.mimeTypeConditionForFileType(
        query.fileType,
      );
      if (mimeTypeCondition) {
        conditions.push(mimeTypeCondition);
      }
    }

    if (query.processingStatus) {
      conditions.push(
        eq(schema.files.processingStatus, query.processingStatus),
      );
    }

    const minSize = Number(query.minSize);
    const maxSize = Number(query.maxSize);
    if (Number.isFinite(minSize) && minSize >= 0) {
      conditions.push(gte(schema.files.size, BigInt(minSize)));
    }
    if (Number.isFinite(maxSize) && maxSize >= 0) {
      conditions.push(lte(schema.files.size, BigInt(maxSize)));
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
    // Soft-deleted files remain in storage; allow admin preview/signed URLs.
    const file = await this.findOrgFile(id, orgId, true);

    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;

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
    await this.findOrgFile(id, orgId, true);

    const [row] = await this.db
      .select({
        fileId: schema.fileProcessorResults.fileId,
        metadata: schema.fileProcessorResults.data,
        extractedAt: schema.fileProcessorResults.processedAt,
        updatedAt: schema.fileProcessorResults.updatedAt,
      })
      .from(schema.fileProcessorResults)
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, id),
          eq(schema.fileProcessorResults.orgId, orgId),
          eq(
            schema.fileProcessorResults.processorKey,
            ProcessorKey.METADATA_EXIF,
          ),
        ),
      )
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

  @Get(':id/processor-results')
  async listProcessorResults(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId, true);

    const rows = await this.db
      .select()
      .from(schema.fileProcessorResults)
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, id),
          eq(schema.fileProcessorResults.orgId, orgId),
        ),
      )
      .orderBy(desc(schema.fileProcessorResults.updatedAt));

    return {
      items: rows.map((row) => toJsonSafe(row)),
      total: rows.length,
    };
  }

  @Get(':id/variants')
  async listVariants(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId, true);
    const variants = await this.variantsService.findByFileId(id);
    return { items: variants, total: variants.length };
  }

  @Post(':id/regenerate-processing')
  @HttpCode(HttpStatus.OK)
  async regenerateProcessing(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Query('scope') scope?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);
    const onlyKeys =
      scope === 'variants'
        ? ['image.normalize', 'image.variants']
        : scope === 'video'
          ? ['video.preview']
          : undefined;
    const result = await this.uploadService.regenerateProcessing(
      id,
      orgId,
      onlyKeys,
    );
    return {
      fileId: id,
      scheduled: result.scheduled,
      message:
        result.scheduled.length > 0
          ? `Scheduled: ${result.scheduled.join(', ')}`
          : 'No processing jobs scheduled (disabled by org settings or unsupported type)',
    };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verifyIntegrity(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId);
    const job = await this.queuesService.enqueueProcessorJob({
      processorKey: ProcessorKey.INTEGRITY_VERIFY,
      orgId,
      fileId: id,
      data: { fileId: id, orgId },
      priority: 2,
    });
    return {
      fileId: id,
      processorKey: ProcessorKey.INTEGRITY_VERIFY,
      jobId: job.id,
      message: 'Integrity verify job queued',
    };
  }

  @Get(':id/duplicates')
  async listDuplicates(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId, true);
    const items = await this.fileDuplicationService.listForFile(id, orgId);
    return { items: items.map((row) => toJsonSafe(row)), total: items.length };
  }

  @Post(':id/duplicates/:duplicateId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDuplicate(
    @Param('id') id: string,
    @Param('duplicateId') duplicateId: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
    @CurrentAdmin() admin?: AdminRequestUser,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId, true);
    const row = await this.fileDuplicationService.confirmDuplicate(
      duplicateId,
      orgId,
      id,
      admin?.adminId,
    );
    return toJsonSafe(row);
  }

  @Post(':id/duplicates/:duplicateId/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismissDuplicate(
    @Param('id') id: string,
    @Param('duplicateId') duplicateId: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.findOrgFile(id, orgId, true);
    await this.fileDuplicationService.dismissDuplicate(duplicateId, orgId, id);
    return emptySuccess({ message: 'Near-duplicate dismissed' });
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
    await this.findOrgFile(id, orgId, true);

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
    return this.findOrgFile(id, orgId, true);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreFile(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const file = await this.findOrgFile(id, orgId, true);

    if (!file.deletedAt) {
      throw new BadRequestException('File is not soft-deleted');
    }

    const restored = await this.fileDeletionService.restore(id);
    if (!restored) {
      throw new BadRequestException('File could not be restored');
    }

    return this.findOrgFile(id, orgId, true);
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

    // Soft-delete only: hide from active lists. Storage object + variants stay.
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
        'File soft-deleted (hidden from active lists; object remains in storage and can be restored)',
    });
  }

  /** Same MIME families as org usage breakdown. */
  private mimeTypeConditionForFileType(fileType: FileTypeFilter): SQL | undefined {
    switch (fileType) {
      case 'images':
        return like(schema.files.mimeType, 'image/%');
      case 'videos':
        return like(schema.files.mimeType, 'video/%');
      case 'audio':
        return like(schema.files.mimeType, 'audio/%');
      case 'documents':
        return or(
          like(schema.files.mimeType, 'application/%'),
          like(schema.files.mimeType, 'text/%'),
        )!;
      case 'other':
        return and(
          not(like(schema.files.mimeType, 'image/%')),
          not(like(schema.files.mimeType, 'video/%')),
          not(like(schema.files.mimeType, 'audio/%')),
          not(like(schema.files.mimeType, 'application/%')),
          not(like(schema.files.mimeType, 'text/%')),
        )!;
      default:
        return undefined;
    }
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
