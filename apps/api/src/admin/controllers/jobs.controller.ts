import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, or, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProcessorKey } from '@workspace/validation';
import { Public } from '../../common/decorators/public.decorator';
import { toJsonSafe } from '../../common/utils/json-safe.util';
import * as schema from '../../database/drizzle/schema';
import { QueuesService } from '../../queues/queues.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { requireOrgId } from '../utils/require-org-id';

const JOB_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const;
const PROCESSOR_KEYS = Object.values(ProcessorKey);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  /** Exact file UUID filter (from Files → View jobs). */
  @IsOptional()
  @IsUUID()
  fileId?: string;

  /** Filename search, or a full file UUID. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];

  @IsOptional()
  @IsIn(PROCESSOR_KEYS)
  processorKey?: ProcessorKey;

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
@Controller('admin/api/jobs')
@UseGuards(AdminAuthGuard)
export class JobsController {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly queuesService: QueuesService,
  ) {}

  @Get()
  async listJobs(
    @Query() query: ListJobsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    // Query params arrive as strings (ValidationPipe returns plain payload).
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(schema.processingJobs.orgId, orgId)];

    const fileId = query.fileId?.trim();
    const search = query.search?.trim();

    if (fileId) {
      conditions.push(eq(schema.processingJobs.fileId, fileId));
    } else if (search) {
      if (UUID_RE.test(search)) {
        conditions.push(eq(schema.processingJobs.fileId, search));
      } else {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(schema.files.originalFileName, pattern),
            ilike(schema.files.fileName, pattern),
          )!,
        );
      }
    }

    if (query.status) {
      conditions.push(eq(schema.processingJobs.status, query.status));
    }
    if (query.processorKey) {
      conditions.push(eq(schema.processingJobs.processorKey, query.processorKey));
    }

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          id: schema.processingJobs.id,
          orgId: schema.processingJobs.orgId,
          fileId: schema.processingJobs.fileId,
          processorKey: schema.processingJobs.processorKey,
          parameters: schema.processingJobs.parameters,
          status: schema.processingJobs.status,
          bullmqJobId: schema.processingJobs.bullmqJobId,
          errorMessage: schema.processingJobs.errorMessage,
          logs: schema.processingJobs.logs,
          output: schema.processingJobs.output,
          retryCount: schema.processingJobs.retryCount,
          progress: schema.processingJobs.progress,
          priority: schema.processingJobs.priority,
          createdAt: schema.processingJobs.createdAt,
          startedAt: schema.processingJobs.startedAt,
          completedAt: schema.processingJobs.completedAt,
          fileName: schema.files.originalFileName,
          mimeType: schema.files.mimeType,
          fileSize: schema.files.size,
          orgName: schema.organizations.name,
          orgSlug: schema.organizations.slug,
        })
        .from(schema.processingJobs)
        .innerJoin(
          schema.files,
          eq(schema.processingJobs.fileId, schema.files.id),
        )
        .innerJoin(
          schema.organizations,
          eq(schema.processingJobs.orgId, schema.organizations.id),
        )
        .where(where)
        .orderBy(desc(schema.processingJobs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(schema.processingJobs)
        .innerJoin(
          schema.files,
          eq(schema.processingJobs.fileId, schema.files.id),
        )
        .where(where),
    ]);

    return {
      items: rows.map((row) => toJsonSafe(row)),
      total: Number(totalResult[0]?.total ?? 0),
      page,
      limit,
    };
  }

  @Get(':id')
  async getJob(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.findOrgJob(id, orgId);
  }

  @Post(':id/cancel')
  async cancelJob(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const job = await this.findOrgJob(id, orgId);

    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new BadRequestException(
        `Cannot cancel job with status "${job.status}"; only pending or processing jobs can be cancelled`,
      );
    }

    const [updated] = await this.db
      .update(schema.processingJobs)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(schema.processingJobs.id, id),
          eq(schema.processingJobs.orgId, orgId),
        ),
      )
      .returning();

    return toJsonSafe(updated);
  }

  @Post(':id/retry')
  async retryJob(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const job = await this.findOrgJob(id, orgId);

    if (job.status !== 'failed' && job.status !== 'cancelled') {
      throw new BadRequestException(
        `Cannot retry job with status "${job.status}"; only failed or cancelled jobs can be retried`,
      );
    }

    const processorKey = String(job.processorKey);
    if (!PROCESSOR_KEYS.includes(processorKey as ProcessorKey)) {
      throw new BadRequestException(
        `Retry is not supported for processor key "${processorKey}"`,
      );
    }

    const nextRetry = Number(job.retryCount ?? 0) + 1;

    await this.db
      .update(schema.processingJobs)
      .set({
        status: 'pending',
        errorMessage: null,
        progress: null,
        startedAt: null,
        completedAt: null,
        retryCount: nextRetry,
        bullmqJobId: null,
        logs: [],
        output: null,
      })
      .where(
        and(
          eq(schema.processingJobs.id, id),
          eq(schema.processingJobs.orgId, orgId),
        ),
      );

    // Clear stale processor result so file detail doesn't keep the previous error.
    await this.db
      .update(schema.fileProcessorResults)
      .set({
        status: 'pending',
        error: null,
        data: {},
        jobId: id,
        processedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.fileProcessorResults.fileId, String(job.fileId)),
          eq(schema.fileProcessorResults.processorKey, processorKey),
          eq(schema.fileProcessorResults.orgId, orgId),
        ),
      );

    await this.queuesService.requeueExistingJob({
      jobId: id,
      orgId,
      fileId: String(job.fileId),
      processorKey,
      retryAttempt: nextRetry,
      parameters: job.parameters as Record<string, unknown> | null,
    });

    return this.findOrgJob(id, orgId);
  }

  private async findOrgJob(id: string, orgId: string) {
    const [job] = await this.db
      .select({
        id: schema.processingJobs.id,
        orgId: schema.processingJobs.orgId,
        fileId: schema.processingJobs.fileId,
        processorKey: schema.processingJobs.processorKey,
        parameters: schema.processingJobs.parameters,
        status: schema.processingJobs.status,
        bullmqJobId: schema.processingJobs.bullmqJobId,
        errorMessage: schema.processingJobs.errorMessage,
        logs: schema.processingJobs.logs,
        output: schema.processingJobs.output,
        retryCount: schema.processingJobs.retryCount,
        progress: schema.processingJobs.progress,
        priority: schema.processingJobs.priority,
        createdAt: schema.processingJobs.createdAt,
        startedAt: schema.processingJobs.startedAt,
        completedAt: schema.processingJobs.completedAt,
        fileName: schema.files.originalFileName,
        mimeType: schema.files.mimeType,
        fileSize: schema.files.size,
        orgName: schema.organizations.name,
        orgSlug: schema.organizations.slug,
      })
      .from(schema.processingJobs)
      .innerJoin(schema.files, eq(schema.processingJobs.fileId, schema.files.id))
      .innerJoin(
        schema.organizations,
        eq(schema.processingJobs.orgId, schema.organizations.id),
      )
      .where(
        and(
          eq(schema.processingJobs.id, id),
          eq(schema.processingJobs.orgId, orgId),
        ),
      )
      .limit(1);

    if (!job) {
      throw new NotFoundException(`Job with id ${id} not found`);
    }

    return toJsonSafe(job);
  }
}
