import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  notInArray,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  ArrayMaxSize,
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
} from "class-validator";
import { Type } from "class-transformer";
import { JobStatus, ProcessorKey } from "@workspace/validation";
import { Public } from "../../common/decorators/public.decorator";
import { toJsonSafe } from "../../common/utils/json-safe.util";
import * as schema from "../../database/drizzle/schema";
import { OrgProcessorsService } from "../../processing/services/org-processors.service";
import {
  buildProcessorJobData,
  processorJobPriority,
  QueuesService,
} from "../../queues/queues.service";
import { AdminAuthGuard } from "../guards/admin-auth.guard";
import { OrgMembershipGuard } from "../guards/org-membership.guard";
import { requireOrgId } from "../utils/require-org-id";

/** Must match DB enum + JobStatusLabels (includes partial / skipped). */
const JOB_STATUSES = Object.values(JobStatus);
const PROCESSOR_KEYS = Object.values(ProcessorKey);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;

  /** Exact file UUID filter (from Files → View jobs). */
  @IsOptional()
  @IsUUID()
  fileId?: string;

  /** Filename search, or a file/job UUID (full or partial). */
  @IsOptional()
  @IsString()
  search?: string;

  /** Single status or comma-separated statuses. */
  @IsOptional()
  @IsString()
  status?: string;

  /** Single processor key or comma-separated keys. */
  @IsOptional()
  @IsString()
  processorKey?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

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

class BulkJobFiltersDto {
  fileId?: string;
  search?: string;
  status?: string;
  processorKey?: string;
  createdFrom?: string;
  createdTo?: string;
}

class BulkJobSelectionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  ids?: string[];

  @IsOptional()
  @IsBoolean()
  allMatchingFilters?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  excludeIds?: string[];

  @IsOptional()
  filters?: BulkJobFiltersDto;
}

class CreateJobDto {
  @IsUUID()
  fileId!: string;

  @IsIn(PROCESSOR_KEYS)
  processorKey!: string;

  @IsOptional()
  @IsUUID()
  backendId?: string | null;

  @IsOptional()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;
}

class RerunJobDto {
  @IsOptional()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  backendId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;
}

class UpdateJobPriorityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority!: number;
}

class BulkPriorityDto extends BulkJobSelectionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority!: number;
}

class CancelAllPendingDto {
  @IsOptional()
  filters?: BulkJobFiltersDto;
}

const BULK_JOB_CAP = 2_000;
const CANCEL_ALL_BATCH_SIZE = 500;
const CANCEL_ALL_MAX_BATCHES = 200;
/** Postgres bind-parameter friendly chunk for `IN (...)` updates. */
const CANCEL_CHUNK_SIZE = 500;

function parseCreatedBound(value: string, endOfDay: boolean): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date "${value}"`);
  }
  if (endOfDay && DATE_ONLY_RE.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function parseStatusFilter(raw: string): JobStatus[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const invalid = parts.filter((s) => !JOB_STATUSES.includes(s as JobStatus));
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Invalid job status value(s): ${invalid.join(", ")}. Allowed: ${JOB_STATUSES.join(", ")}`,
    );
  }
  return [...new Set(parts)] as JobStatus[];
}

function parseProcessorKeyFilter(raw: string): ProcessorKey[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const invalid = parts.filter(
    (s) => !PROCESSOR_KEYS.includes(s as ProcessorKey),
  );
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Invalid processorKey value(s): ${invalid.join(", ")}. Allowed: ${PROCESSOR_KEYS.join(", ")}`,
    );
  }
  return [...new Set(parts)] as ProcessorKey[];
}

function buildJobListConditions(
  orgId: string,
  filters: BulkJobFiltersDto,
): SQL[] {
  const conditions: SQL[] = [eq(schema.processingJobs.orgId, orgId)];
  const fileId = filters.fileId?.trim();
  const search = filters.search?.trim();

  if (fileId) {
    conditions.push(eq(schema.processingJobs.fileId, fileId));
  } else if (search) {
    if (UUID_RE.test(search)) {
      conditions.push(
        or(
          eq(schema.processingJobs.fileId, search),
          eq(schema.processingJobs.id, search),
        )!,
      );
    } else {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(schema.files.originalFileName, pattern),
          ilike(schema.files.fileName, pattern),
          sql`${schema.processingJobs.id}::text ilike ${pattern}`,
          sql`${schema.processingJobs.fileId}::text ilike ${pattern}`,
        )!,
      );
    }
  }

  if (filters.status?.trim()) {
    const statuses = parseStatusFilter(filters.status);
    if (statuses.length === 1) {
      conditions.push(eq(schema.processingJobs.status, statuses[0]!));
    } else if (statuses.length > 1) {
      conditions.push(inArray(schema.processingJobs.status, statuses));
    }
  }
  if (filters.processorKey?.trim()) {
    const keys = parseProcessorKeyFilter(filters.processorKey);
    if (keys.length === 1) {
      conditions.push(eq(schema.processingJobs.processorKey, keys[0]!));
    } else if (keys.length > 1) {
      conditions.push(inArray(schema.processingJobs.processorKey, keys));
    }
  }
  if (filters.createdFrom) {
    conditions.push(
      gte(
        schema.processingJobs.createdAt,
        parseCreatedBound(filters.createdFrom, false),
      ),
    );
  }
  if (filters.createdTo) {
    conditions.push(
      lte(
        schema.processingJobs.createdAt,
        parseCreatedBound(filters.createdTo, true),
      ),
    );
  }

  return conditions;
}

@Public()
@Controller({ path: "admin/api/jobs", version: VERSION_NEUTRAL })
@UseGuards(AdminAuthGuard, OrgMembershipGuard)
export class JobsController {
  constructor(
    @Inject("DRIZZLE_DB")
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly queuesService: QueuesService,
    private readonly orgProcessors: OrgProcessorsService,
  ) {}

  @Get()
  async listJobs(
    @Query() query: ListJobsQueryDto,
    @Headers("x-org-id") headerOrgId?: string,
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
        conditions.push(
          or(
            eq(schema.processingJobs.fileId, search),
            eq(schema.processingJobs.id, search),
          )!,
        );
      } else {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(schema.files.originalFileName, pattern),
            ilike(schema.files.fileName, pattern),
            sql`${schema.processingJobs.id}::text ilike ${pattern}`,
            sql`${schema.processingJobs.fileId}::text ilike ${pattern}`,
          )!,
        );
      }
    }

    if (query.status?.trim()) {
      const statuses = parseStatusFilter(query.status);
      if (statuses.length === 1) {
        conditions.push(eq(schema.processingJobs.status, statuses[0]!));
      } else if (statuses.length > 1) {
        conditions.push(inArray(schema.processingJobs.status, statuses));
      }
    }
    if (query.processorKey?.trim()) {
      const keys = parseProcessorKeyFilter(query.processorKey);
      if (keys.length === 1) {
        conditions.push(eq(schema.processingJobs.processorKey, keys[0]!));
      } else if (keys.length > 1) {
        conditions.push(inArray(schema.processingJobs.processorKey, keys));
      }
    }
    if (query.createdFrom) {
      conditions.push(
        gte(
          schema.processingJobs.createdAt,
          parseCreatedBound(query.createdFrom, false),
        ),
      );
    }
    if (query.createdTo) {
      conditions.push(
        lte(
          schema.processingJobs.createdAt,
          parseCreatedBound(query.createdTo, true),
        ),
      );
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

  @Post("bulk-cancel")
  async bulkCancelJobs(
    @Body() body: BulkJobSelectionDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const ids = await this.resolveBulkJobIds(orgId, body);
    return this.cancelJobsByIds(orgId, ids);
  }

  /**
   * Cancel every pending job in the org (optionally narrowed by the same
   * filters as the jobs list). Runs in batches so the whole backlog can be
   * cleared without the bulk selection cap.
   */
  @Post("cancel-all-pending")
  async cancelAllPendingJobs(
    @Body() body: CancelAllPendingDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const conditions = buildJobListConditions(orgId, {
      ...(body?.filters ?? {}),
      status: JobStatus.PENDING,
    });

    let cancelled = 0;
    for (let batch = 0; batch < CANCEL_ALL_MAX_BATCHES; batch++) {
      const rows = await this.db
        .select({ id: schema.processingJobs.id })
        .from(schema.processingJobs)
        .leftJoin(schema.files, eq(schema.processingJobs.fileId, schema.files.id))
        .where(and(...conditions))
        .limit(CANCEL_ALL_BATCH_SIZE);
      if (rows.length === 0) break;

      const result = await this.cancelJobsByIds(
        orgId,
        rows.map((row) => row.id),
      );
      cancelled += result.cancelled;
      // Nothing moved (rows changed status concurrently) — stop instead of looping.
      if (result.cancelled === 0) break;
    }

    return { cancelled, skipped: 0 };
  }

  @Post("bulk-retry")
  async bulkRetryJobs(
    @Body() body: BulkJobSelectionDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    let retried = 0;
    let skipped = 0;
    const errors: string[] = [];

    const ids = await this.resolveBulkJobIds(orgId, body);
    for (const id of ids) {
      try {
        await this.retryJobById(id, orgId);
        retried++;
      } catch (err) {
        skipped++;
        errors.push(
          `${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      retried,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  @Post("bulk-priority")
  async bulkUpdatePriority(
    @Body() body: BulkPriorityDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const ids = await this.resolveBulkJobIds(orgId, body);
    for (const id of ids) {
      try {
        await this.updatePriorityById(id, orgId, body.priority);
        updated++;
      } catch (err) {
        skipped++;
        errors.push(
          `${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      updated,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  @Post("bulk-prioritize")
  async bulkPrioritizeJobs(
    @Body() body: BulkJobSelectionDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const ids = await this.resolveBulkJobIds(orgId, body);
    let prioritized = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.prioritizeJobById(id, orgId);
        prioritized++;
      } catch (err) {
        skipped++;
        errors.push(
          `${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      prioritized,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  @Post()
  async createJob(
    @Body() body: CreateJobDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.createJobForFile({
      orgId,
      fileId: body.fileId,
      processorKey: body.processorKey,
      backendId: body.backendId,
      parameters: body.parameters,
      priority: body.priority,
    });
  }

  /**
   * Processors that can still be added for a file: enabled in the org
   * processing settings, MIME-compatible, and not already in the file's job
   * list (existing rows are rerun instead of added again).
   */
  @Get("available-processors")
  async listAvailableProcessors(
    @Query("fileId") fileId?: string,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const trimmedFileId = fileId?.trim();
    if (!trimmedFileId || !UUID_RE.test(trimmedFileId)) {
      throw new BadRequestException("A valid fileId is required");
    }

    const [file] = await this.db
      .select({
        id: schema.files.id,
        mimeType: schema.files.mimeType,
        deletedAt: schema.files.deletedAt,
      })
      .from(schema.files)
      .where(
        and(eq(schema.files.id, trimmedFileId), eq(schema.files.orgId, orgId)),
      )
      .limit(1);

    if (!file) {
      throw new NotFoundException(`File ${trimmedFileId} not found`);
    }

    const enabled = await this.orgProcessors.getEnabledForFile(
      orgId,
      String(file.mimeType ?? ""),
    );

    const existingRows = await this.db
      .selectDistinct({ processorKey: schema.processingJobs.processorKey })
      .from(schema.processingJobs)
      .where(
        and(
          eq(schema.processingJobs.fileId, trimmedFileId),
          eq(schema.processingJobs.orgId, orgId),
        ),
      );
    const alreadyQueued = new Set(existingRows.map((row) => row.processorKey));

    const items = enabled
      .filter((processor) => !alreadyQueued.has(processor.processorKey))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((processor) => ({
        processorKey: processor.processorKey,
        backendId: processor.backendId ?? null,
        sortOrder: processor.sortOrder ?? 0,
      }));

    return { items, fileDeleted: !!file.deletedAt };
  }

  @Get(":id")
  async getJob(
    @Param("id") id: string,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.findOrgJob(id, orgId);
  }

  @Post(":id/cancel")
  async cancelJob(
    @Param("id") id: string,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.cancelJobById(id, orgId);
  }

  @Post(":id/retry")
  async retryJob(
    @Param("id") id: string,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.retryJobById(id, orgId);
  }

  @Post(":id/rerun")
  async rerunJob(
    @Param("id") id: string,
    @Body() body: RerunJobDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const job = await this.findOrgJob(id, orgId);
    const terminal = new Set([
      "completed",
      "failed",
      "cancelled",
      "skipped",
      "partial",
    ]);
    if (!terminal.has(String(job.status))) {
      throw new BadRequestException(
        `Cannot rerun job with status "${job.status}"; only terminal jobs can be rerun as a new history row`,
      );
    }

    const existingParams =
      job.parameters && typeof job.parameters === "object"
        ? (job.parameters as Record<string, unknown>)
        : {};

    return this.createJobForFile({
      orgId,
      fileId: String(job.fileId),
      processorKey: String(job.processorKey),
      backendId:
        body.backendId !== undefined
          ? body.backendId
          : typeof existingParams.backendId === "string"
            ? existingParams.backendId
            : null,
      parameters: {
        ...existingParams,
        ...(body.parameters ?? {}),
      },
      priority: body.priority,
    });
  }

  @Post(":id/priority")
  async updateJobPriority(
    @Param("id") id: string,
    @Body() body: UpdateJobPriorityDto,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.updatePriorityById(id, orgId, body.priority);
  }

  @Post(":id/prioritize")
  async prioritizeJob(
    @Param("id") id: string,
    @Query("orgId") queryOrgId?: string,
    @Headers("x-org-id") headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.prioritizeJobById(id, orgId);
  }

  private async createJobForFile(input: {
    orgId: string;
    fileId: string;
    processorKey: string;
    backendId?: string | null;
    parameters?: Record<string, unknown>;
    priority?: number;
  }) {
    if (!PROCESSOR_KEYS.includes(input.processorKey as ProcessorKey)) {
      throw new BadRequestException(
        `Unsupported processor key "${input.processorKey}"`,
      );
    }

    const [file] = await this.db
      .select({
        id: schema.files.id,
        orgId: schema.files.orgId,
        mimeType: schema.files.mimeType,
        deletedAt: schema.files.deletedAt,
      })
      .from(schema.files)
      .where(
        and(
          eq(schema.files.id, input.fileId),
          eq(schema.files.orgId, input.orgId),
        ),
      )
      .limit(1);

    if (!file) {
      throw new NotFoundException(`File ${input.fileId} not found`);
    }
    if (file.deletedAt) {
      throw new BadRequestException("Cannot enqueue jobs for a deleted file");
    }

    const enabled = await this.orgProcessors.getEnabledForFile(
      input.orgId,
      String(file.mimeType ?? ""),
    );
    if (!enabled.some((p) => p.processorKey === input.processorKey)) {
      throw new BadRequestException(
        `Processor "${input.processorKey}" is not enabled for this organization or does not accept this file type`,
      );
    }

    const [inflight] = await this.db
      .select({ id: schema.processingJobs.id })
      .from(schema.processingJobs)
      .where(
        and(
          eq(schema.processingJobs.fileId, input.fileId),
          eq(schema.processingJobs.processorKey, input.processorKey),
          inArray(schema.processingJobs.status, ["pending", "processing"]),
        ),
      )
      .limit(1);
    if (inflight) {
      throw new BadRequestException(
        `An in-flight ${input.processorKey} job already exists for this file`,
      );
    }

    let backendId = input.backendId ?? null;
    if (backendId) {
      const [backend] = await this.db
        .select({ id: schema.processorBackends.id })
        .from(schema.processorBackends)
        .where(
          and(
            eq(schema.processorBackends.id, backendId),
            eq(schema.processorBackends.orgId, input.orgId),
          ),
        )
        .limit(1);
      if (!backend) {
        throw new BadRequestException(
          "Backend does not belong to this organization",
        );
      }
    } else {
      const [orgProc] = await this.db
        .select({ backendId: schema.orgProcessors.backendId })
        .from(schema.orgProcessors)
        .where(
          and(
            eq(schema.orgProcessors.orgId, input.orgId),
            eq(schema.orgProcessors.processorKey, input.processorKey),
          ),
        )
        .limit(1);
      backendId = orgProc?.backendId ?? null;
    }

    const [orgProc] = await this.db
      .select({ settings: schema.orgProcessors.settings })
      .from(schema.orgProcessors)
      .where(
        and(
          eq(schema.orgProcessors.orgId, input.orgId),
          eq(schema.orgProcessors.processorKey, input.processorKey),
        ),
      )
      .limit(1);

    const orgSettings =
      orgProc?.settings && typeof orgProc.settings === "object"
        ? (orgProc.settings as Record<string, unknown>)
        : {};

    const mergedParameters = {
      ...orgSettings,
      ...(input.parameters ?? {}),
      ...(backendId ? { backendId } : {}),
    };

    const priority = input.priority ?? processorJobPriority(input.processorKey);

    await this.queuesService.enqueueProcessorJob({
      processorKey: input.processorKey,
      orgId: input.orgId,
      fileId: input.fileId,
      backendId,
      parameters: mergedParameters,
      data: buildProcessorJobData(input.processorKey, {
        fileId: input.fileId,
        orgId: input.orgId,
        parameters: mergedParameters,
      }),
      priority,
    });

    const [created] = await this.db
      .select({ id: schema.processingJobs.id })
      .from(schema.processingJobs)
      .where(
        and(
          eq(schema.processingJobs.fileId, input.fileId),
          eq(schema.processingJobs.processorKey, input.processorKey),
          eq(schema.processingJobs.orgId, input.orgId),
          inArray(schema.processingJobs.status, ["pending", "processing"]),
        ),
      )
      .orderBy(desc(schema.processingJobs.createdAt))
      .limit(1);

    if (!created) {
      throw new BadRequestException("Job was enqueued but could not be loaded");
    }
    return this.findOrgJob(created.id, input.orgId);
  }

  private async updatePriorityById(
    id: string,
    orgId: string,
    priority: number,
  ) {
    const job = await this.findOrgJob(id, orgId);
    if (job.status !== "pending") {
      throw new BadRequestException(
        `Cannot change priority for job with status "${job.status}"; only pending jobs can be reprioritized`,
      );
    }

    const [updated] = await this.db
      .update(schema.processingJobs)
      .set({ priority })
      .where(
        and(
          eq(schema.processingJobs.id, id),
          eq(schema.processingJobs.orgId, orgId),
        ),
      )
      .returning();

    await this.queuesService.updateJobPriority({
      bullmqJobId: String(job.bullmqJobId ?? job.id),
      processorKey: String(job.processorKey),
      priority,
    });

    return toJsonSafe(updated);
  }

  private async prioritizeJobById(id: string, orgId: string) {
    const job = await this.findOrgJob(id, orgId);
    if (job.status !== "pending") {
      throw new BadRequestException(
        `Cannot prioritize job with status "${job.status}"; only pending jobs can be moved to the front`,
      );
    }

    const moved = await this.queuesService.prioritizeWaitingJob({
      bullmqJobId: String(job.bullmqJobId ?? job.id),
      processorKey: String(job.processorKey),
    });
    if (!moved) {
      throw new BadRequestException(
        "Job is no longer waiting in the processor queue",
      );
    }

    const [updated] = await this.db
      .update(schema.processingJobs)
      .set({ priority: 0 })
      .where(
        and(
          eq(schema.processingJobs.id, id),
          eq(schema.processingJobs.orgId, orgId),
        ),
      )
      .returning();
    return toJsonSafe(updated);
  }

  private async resolveBulkJobIds(
    orgId: string,
    body: BulkJobSelectionDto,
  ): Promise<string[]> {
    if (body.allMatchingFilters) {
      const conditions = buildJobListConditions(orgId, body.filters ?? {});
      if (body.excludeIds?.length) {
        conditions.push(notInArray(schema.processingJobs.id, body.excludeIds));
      }
      const rows = await this.db
        .select({ id: schema.processingJobs.id })
        .from(schema.processingJobs)
        .innerJoin(
          schema.files,
          eq(schema.processingJobs.fileId, schema.files.id),
        )
        .where(and(...conditions))
        .limit(BULK_JOB_CAP);
      return rows.map((row) => row.id);
    }

    const ids = [...new Set((body.ids ?? []).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException(
        "Provide ids or set allMatchingFilters=true",
      );
    }
    if (ids.length > BULK_JOB_CAP) {
      throw new BadRequestException(
        `Cannot process more than ${BULK_JOB_CAP} jobs in one request`,
      );
    }
    const rows = await this.db
      .select({ id: schema.processingJobs.id })
      .from(schema.processingJobs)
      .where(
        and(
          eq(schema.processingJobs.orgId, orgId),
          inArray(schema.processingJobs.id, ids),
        ),
      );
    return rows.map((row) => row.id);
  }

  /**
   * The DB row is flipped to `cancelled` first so a worker that already holds
   * the job bails out instead of resurrecting it, then the BullMQ entry is
   * dropped (best effort — an active job cannot be removed mid-run).
   */
  private async cancelJobById(id: string, orgId: string) {
    const job = await this.findOrgJob(id, orgId);

    const [updated] = await this.db
      .update(schema.processingJobs)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(
        and(
          eq(schema.processingJobs.id, id),
          eq(schema.processingJobs.orgId, orgId),
          inArray(schema.processingJobs.status, ["pending", "processing"]),
        ),
      )
      .returning();

    if (!updated) {
      throw new BadRequestException(
        `Cannot cancel job with status "${job.status}"; only pending or processing jobs can be cancelled`,
      );
    }

    await this.dropQueuedJob({
      id: String(updated.id),
      bullmqJobId: updated.bullmqJobId,
      processorKey: String(updated.processorKey),
    });

    return toJsonSafe(updated);
  }

  /** Cancel many jobs with one UPDATE per chunk instead of a row-by-row loop. */
  private async cancelJobsByIds(orgId: string, ids: string[]) {
    let cancelled = 0;

    for (let start = 0; start < ids.length; start += CANCEL_CHUNK_SIZE) {
      const chunk = ids.slice(start, start + CANCEL_CHUNK_SIZE);
      if (chunk.length === 0) continue;

      const updated = await this.db
        .update(schema.processingJobs)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(
          and(
            eq(schema.processingJobs.orgId, orgId),
            inArray(schema.processingJobs.id, chunk),
            inArray(schema.processingJobs.status, ["pending", "processing"]),
          ),
        )
        .returning({
          id: schema.processingJobs.id,
          bullmqJobId: schema.processingJobs.bullmqJobId,
          processorKey: schema.processingJobs.processorKey,
        });

      cancelled += updated.length;

      for (const row of updated) {
        await this.dropQueuedJob({
          id: String(row.id),
          bullmqJobId: row.bullmqJobId,
          processorKey: String(row.processorKey),
        });
      }
    }

    return { cancelled, skipped: Math.max(0, ids.length - cancelled) };
  }

  /**
   * Remove the queued BullMQ entry for a cancelled row. Older rows can carry a
   * stale/missing `bullmqJobId`, so the row id is tried as well.
   */
  private async dropQueuedJob(job: {
    id: string;
    bullmqJobId: string | null;
    processorKey: string;
  }) {
    const candidates = [job.bullmqJobId, job.id].filter(
      (value, index, all): value is string =>
        !!value && all.indexOf(value) === index,
    );
    for (const bullmqJobId of candidates) {
      const removed = await this.queuesService.removeWaitingJob({
        bullmqJobId,
        processorKey: job.processorKey,
      });
      if (removed) return;
    }
  }

  private async retryJobById(id: string, orgId: string) {
    const job = await this.findOrgJob(id, orgId);

    const retryable = new Set(["failed", "cancelled", "skipped", "partial"]);
    if (!retryable.has(String(job.status))) {
      throw new BadRequestException(
        `Cannot retry job with status "${job.status}"; only failed, cancelled, skipped, or partial jobs can be retried`,
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
        status: "pending",
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
        status: "pending",
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
      .innerJoin(
        schema.files,
        eq(schema.processingJobs.fileId, schema.files.id),
      )
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
