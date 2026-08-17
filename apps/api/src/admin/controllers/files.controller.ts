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
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  SQL,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
import { DirectUploadService } from '../../upload/services/direct-upload.service';
import { UploadService } from '../../upload/services/upload.service';
import { VariantType } from '../../variants/repositories/variants.repository';
import { VariantsService } from '../../variants/services/variants.service';
import {
  CurrentAdmin,
  type AdminRequestUser,
} from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { OrgMembershipGuard } from '../guards/org-membership.guard';
import {
  FilesBulkProcessingService,
  MAX_SWEEP_FILES,
} from '../services/files-bulk-processing.service';
import { buildFileListConditions } from '../utils/file-list-filters';
import { requireOrgId } from '../utils/require-org-id';

class ListFilesQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** MIME family: images | videos | … or comma-separated list. */
  @IsOptional()
  @IsString()
  fileType?: string;

  /** Processing status or comma-separated statuses. */
  @IsOptional()
  @IsString()
  processingStatus?: string;

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
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

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

class BulkRegenerateProcessingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

/** Same filter shape as the Files table so "all matching" equals what is listed. */
class RegenerateProcessingAllDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsString()
  processingStatus?: string;

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
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  /** Optional ceiling on how many files this run schedules. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SWEEP_FILES)
  limit?: number;
}

class BulkSelectionFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsString()
  processingStatus?: string;

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
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsBoolean()
  deletedOnly?: boolean;
}

class BulkFileSelectionDto {
  /** Explicit IDs (page / cherry-pick). Mutually exclusive with allMatchingFilters. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  ids?: string[];

  /** Select every file matching filters (across pages). */
  @IsOptional()
  @IsBoolean()
  allMatchingFilters?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  excludeIds?: string[];

  @IsOptional()
  filters?: BulkSelectionFiltersDto;

  @IsOptional()
  @IsBoolean()
  hard?: boolean;
}

class EmptyTrashDto {
  @IsString()
  @IsIn(['DELETE'])
  confirm!: string;
}

const BULK_FILE_CAP = 2_000;

@Public()
@Controller({ path: 'admin/api/files', version: VERSION_NEUTRAL })
@UseGuards(AdminAuthGuard, OrgMembershipGuard)
export class FilesController {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly uploadService: UploadService,
    private readonly directUpload: DirectUploadService,
    private readonly signedUrlService: SignedUrlService,
    private readonly servingService: ServingService,
    private readonly fileDeletionService: FileDeletionService,
    private readonly fileDuplicationService: FileDuplicationService,
    private readonly variantsService: VariantsService,
    private readonly queuesService: QueuesService,
    private readonly bulkProcessing: FilesBulkProcessingService,
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

  @Post('upload/initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiateDirectUpload(
    @Body()
    body: {
      filename?: string;
      mimeType?: string;
      size?: number;
      storageProviderId?: string;
      storageKey?: string;
      skipProcessing?: boolean;
      multipart?: boolean;
      orgId?: string;
    },
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
    @CurrentAdmin() admin?: AdminRequestUser,
  ) {
    const orgId = requireOrgId(queryOrgId || body.orgId, headerOrgId);
    if (!body.filename || body.size == null || !body.mimeType) {
      throw new BadRequestException('filename, mimeType, and size are required');
    }
    return this.directUpload.initiate(
      orgId,
      {
        filename: body.filename,
        mimeType: body.mimeType,
        size: Number(body.size),
        storageProviderId: body.storageProviderId,
        storageKey: body.storageKey,
        skipProcessing: body.skipProcessing,
        multipart: body.multipart,
      },
      admin?.adminId,
    );
  }

  @Post('upload/multipart/part-url')
  @HttpCode(HttpStatus.OK)
  async directUploadPartUrl(
    @Body() body: { fileId?: string; partNumber?: number; orgId?: string },
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId || body.orgId, headerOrgId);
    if (!body.fileId || body.partNumber == null) {
      throw new BadRequestException('fileId and partNumber are required');
    }
    return this.directUpload.getPartUrl(orgId, {
      fileId: body.fileId,
      partNumber: Number(body.partNumber),
    });
  }

  @Post('upload/complete')
  @HttpCode(HttpStatus.CREATED)
  async completeDirectUpload(
    @Body()
    body: {
      fileId?: string;
      sha256Hash?: string;
      skipProcessing?: boolean;
      parts?: Array<{ partNumber: number; etag: string }>;
      orgId?: string;
    },
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
    @CurrentAdmin() admin?: AdminRequestUser,
  ) {
    const orgId = requireOrgId(queryOrgId || body.orgId, headerOrgId);
    if (!body.fileId || !body.sha256Hash) {
      throw new BadRequestException('fileId and sha256Hash are required');
    }
    return this.directUpload.complete(
      orgId,
      {
        fileId: body.fileId,
        sha256Hash: body.sha256Hash,
        skipProcessing: body.skipProcessing,
        parts: body.parts,
      },
      admin?.adminId,
    );
  }

  @Post('upload/abort')
  @HttpCode(HttpStatus.OK)
  async abortDirectUpload(
    @Body() body: { fileId?: string; orgId?: string },
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId || body.orgId, headerOrgId);
    if (!body.fileId) {
      throw new BadRequestException('fileId is required');
    }
    return this.directUpload.abort(orgId, body.fileId);
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
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions = buildFileListConditions(orgId, {
      search: query.search,
      fileType: query.fileType,
      processingStatus: query.processingStatus,
      minSize: query.minSize,
      maxSize: query.maxSize,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      includeDeleted: query.includeDeleted,
      deletedOnly: query.deletedOnly,
    });

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          id: schema.files.id,
          orgId: schema.files.orgId,
          storageProviderId: schema.files.storageProviderId,
          storageKey: schema.files.storageKey,
          storageBucket: schema.files.storageBucket,
          fileName: schema.files.fileName,
          originalFileName: schema.files.originalFileName,
          fileExtension: schema.files.fileExtension,
          mimeType: schema.files.mimeType,
          size: schema.files.size,
          fileHash: schema.files.fileHash,
          perceptualHash: schema.files.perceptualHash,
          width: schema.files.width,
          height: schema.files.height,
          duration: schema.files.duration,
          alt: schema.files.alt,
          title: schema.files.title,
          caption: schema.files.caption,
          description: schema.files.description,
          folder: schema.files.folder,
          folderId: schema.files.folderId,
          tags: schema.files.tags,
          referenceCount: schema.files.referenceCount,
          isOrphaned: schema.files.isOrphaned,
          orphanedAt: schema.files.orphanedAt,
          processingStatus: schema.files.processingStatus,
          processingError: schema.files.processingError,
          visibility: schema.files.visibility,
          uploadedBy: schema.files.uploadedBy,
          externalId: schema.files.externalId,
          externalProvider: schema.files.externalProvider,
          cdnUrl: schema.files.cdnUrl,
          deletedAt: schema.files.deletedAt,
          createdAt: schema.files.createdAt,
          updatedAt: schema.files.updatedAt,
          storageProviderName: schema.storageProviders.name,
          storageProviderType: schema.storageProviders.type,
        })
        .from(schema.files)
        .leftJoin(
          schema.storageProviders,
          eq(schema.files.storageProviderId, schema.storageProviders.id),
        )
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

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkDeleteFiles(
    @Body() body: BulkFileSelectionDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const ids = await this.resolveBulkFileIds(orgId, body);
    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        if (body.hard) {
          await this.findOrgFile(id, orgId, true);
          await this.fileDeletionService.hardDelete(id, true);
        } else {
          await this.findOrgFile(id, orgId);
          await this.db
            .update(schema.files)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(schema.files.id, id), eq(schema.files.orgId, orgId)));
        }
        deleted++;
      } catch (err) {
        skipped++;
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      deleted,
      skipped,
      hard: !!body.hard,
      ...(errors.length > 0 ? { errors: errors.slice(0, 50) } : {}),
    };
  }

  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  async bulkRestoreFiles(
    @Body() body: BulkFileSelectionDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const selection = {
      ...body,
      filters: {
        ...(body.filters ?? {}),
        deletedOnly: true,
      },
    };
    const ids = await this.resolveBulkFileIds(orgId, selection);
    let restored = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const ok = await this.fileDeletionService.restore(id);
        if (ok) restored++;
        else skipped++;
      } catch (err) {
        skipped++;
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      restored,
      skipped,
      ...(errors.length > 0 ? { errors: errors.slice(0, 50) } : {}),
    };
  }

  @Post('empty-trash')
  @HttpCode(HttpStatus.OK)
  async emptyTrash(
    @Body() body: EmptyTrashDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    if (body.confirm !== 'DELETE') {
      throw new BadRequestException('confirm must be the string DELETE');
    }

    const rows = await this.db
      .select({ id: schema.files.id })
      .from(schema.files)
      .where(
        and(eq(schema.files.orgId, orgId), isNotNull(schema.files.deletedAt)),
      )
      .limit(BULK_FILE_CAP);

    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await this.fileDeletionService.hardDelete(row.id, true);
        deleted++;
      } catch (err) {
        skipped++;
        errors.push(
          `${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      deleted,
      skipped,
      capped: rows.length >= BULK_FILE_CAP,
      ...(errors.length > 0 ? { errors: errors.slice(0, 50) } : {}),
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
      orgId,
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

  @Post('bulk-regenerate-processing')
  @HttpCode(HttpStatus.OK)
  async bulkRegenerateProcessing(
    @Body() body: BulkRegenerateProcessingDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const uniqueIds = [...new Set(body.ids)];
    const results = await Promise.allSettled(
      uniqueIds.map(async (id) => {
        await this.findOrgFile(id, orgId);
        const result = await this.uploadService.regenerateProcessing(id, orgId);
        return { id, scheduled: result.scheduled };
      }),
    );

    const succeeded: { id: string; scheduled: string[] }[] = [];
    const failed: { id: string; error: string }[] = [];
    results.forEach((result, index) => {
      const id = uniqueIds[index]!;
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        failed.push({
          id,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    return { succeeded, failed };
  }

  /**
   * Schedule processing for every file matching the current Files-table filters,
   * not just the loaded page. Runs detached; poll the status endpoint.
   */
  @Post('regenerate-processing-all')
  @HttpCode(HttpStatus.ACCEPTED)
  async regenerateProcessingAll(
    @Body() body: RegenerateProcessingAllDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId || body.orgId, headerOrgId);
    const { matched, progress } = await this.bulkProcessing.start(
      orgId,
      {
        search: body.search,
        fileType: body.fileType,
        processingStatus: body.processingStatus,
        minSize: body.minSize,
        maxSize: body.maxSize,
        createdFrom: body.createdFrom,
        createdTo: body.createdTo,
      },
      body.limit,
    );

    return {
      matched,
      progress,
      message:
        matched > 0
          ? `Scheduling processing for ${matched} files`
          : 'No files matched the current filters',
    };
  }

  @Get('regenerate-processing-all/status')
  async regenerateProcessingAllStatus(
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return { progress: this.bulkProcessing.getProgress(orgId) };
  }

  @Post('regenerate-processing-all/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelRegenerateProcessingAll(
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const cancelled = this.bulkProcessing.requestCancel(orgId);
    return {
      cancelled,
      progress: this.bulkProcessing.getProgress(orgId),
      message: cancelled
        ? 'Cancellation requested; the current batch will finish first'
        : 'No bulk processing run is in progress',
    };
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
      {
        headers: request?.headers as
          | Record<string, string | string[] | undefined>
          | undefined,
        referer: (() => {
          const raw =
            request?.headers?.['referer'] ?? request?.headers?.['referrer'];
          if (typeof raw === 'string') return raw;
          if (Array.isArray(raw)) return raw[0];
          return undefined;
        })(),
        downloadMethod: 'direct',
      },
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

  private async resolveBulkFileIds(
    orgId: string,
    body: BulkFileSelectionDto,
  ): Promise<string[]> {
    if (body.allMatchingFilters) {
      const conditions = buildFileListConditions(orgId, {
        search: body.filters?.search,
        fileType: body.filters?.fileType,
        processingStatus: body.filters?.processingStatus,
        minSize: body.filters?.minSize,
        maxSize: body.filters?.maxSize,
        createdFrom: body.filters?.createdFrom,
        createdTo: body.filters?.createdTo,
        includeDeleted: body.filters?.includeDeleted,
        deletedOnly: body.filters?.deletedOnly,
      });
      if (body.excludeIds && body.excludeIds.length > 0) {
        conditions.push(notInArray(schema.files.id, body.excludeIds));
      }
      const rows = await this.db
        .select({ id: schema.files.id })
        .from(schema.files)
        .where(and(...conditions))
        .limit(BULK_FILE_CAP);
      return rows.map((r) => r.id);
    }

    const ids = [...new Set((body.ids ?? []).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException(
        'Provide ids or set allMatchingFilters=true',
      );
    }
    if (ids.length > BULK_FILE_CAP) {
      throw new BadRequestException(
        `Cannot process more than ${BULK_FILE_CAP} files in one request`,
      );
    }

    const rows = await this.db
      .select({ id: schema.files.id })
      .from(schema.files)
      .where(
        and(eq(schema.files.orgId, orgId), inArray(schema.files.id, ids)),
      );
    return rows.map((r) => r.id);
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
