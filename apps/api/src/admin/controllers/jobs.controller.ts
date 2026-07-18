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
import { and, count, desc, eq, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../../common/decorators/public.decorator';
import { toJsonSafe } from '../../common/utils/json-safe.util';
import * as schema from '../../database/drizzle/schema';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { requireOrgId } from '../utils/require-org-id';

const JOB_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const;
const JOB_TYPES = ['image', 'video', 'metadata', 'thumbnail', 'transcode'] as const;

class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];

  @IsOptional()
  @IsIn(JOB_TYPES)
  jobType?: (typeof JOB_TYPES)[number];

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
  ) {}

  @Get()
  async listJobs(
    @Query() query: ListJobsQueryDto,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(query.orgId, headerOrgId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(schema.processingJobs.orgId, orgId)];
    if (query.status) {
      conditions.push(eq(schema.processingJobs.status, query.status));
    }
    if (query.jobType) {
      conditions.push(eq(schema.processingJobs.jobType, query.jobType));
    }

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          id: schema.processingJobs.id,
          orgId: schema.processingJobs.orgId,
          fileId: schema.processingJobs.fileId,
          jobType: schema.processingJobs.jobType,
          status: schema.processingJobs.status,
          bullmqJobId: schema.processingJobs.bullmqJobId,
          errorMessage: schema.processingJobs.errorMessage,
          retryCount: schema.processingJobs.retryCount,
          progress: schema.processingJobs.progress,
          priority: schema.processingJobs.priority,
          createdAt: schema.processingJobs.createdAt,
          startedAt: schema.processingJobs.startedAt,
          completedAt: schema.processingJobs.completedAt,
          fileName: schema.files.originalFileName,
          mimeType: schema.files.mimeType,
          fileSize: schema.files.size,
        })
        .from(schema.processingJobs)
        .innerJoin(
          schema.files,
          eq(schema.processingJobs.fileId, schema.files.id),
        )
        .where(where)
        .orderBy(desc(schema.processingJobs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(schema.processingJobs)
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

  private async findOrgJob(id: string, orgId: string) {
    const [job] = await this.db
      .select({
        id: schema.processingJobs.id,
        orgId: schema.processingJobs.orgId,
        fileId: schema.processingJobs.fileId,
        jobType: schema.processingJobs.jobType,
        status: schema.processingJobs.status,
        bullmqJobId: schema.processingJobs.bullmqJobId,
        errorMessage: schema.processingJobs.errorMessage,
        retryCount: schema.processingJobs.retryCount,
        progress: schema.processingJobs.progress,
        priority: schema.processingJobs.priority,
        createdAt: schema.processingJobs.createdAt,
        startedAt: schema.processingJobs.startedAt,
        completedAt: schema.processingJobs.completedAt,
        fileName: schema.files.originalFileName,
        mimeType: schema.files.mimeType,
        fileSize: schema.files.size,
      })
      .from(schema.processingJobs)
      .innerJoin(schema.files, eq(schema.processingJobs.fileId, schema.files.id))
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
