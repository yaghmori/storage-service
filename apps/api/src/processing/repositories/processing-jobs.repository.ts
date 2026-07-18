import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';

@Injectable()
export class ProcessingJobsRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: {
    fileId: string;
    orgId?: string;
    jobType: 'image' | 'video' | 'metadata' | 'thumbnail' | 'transcode';
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    bullmqJobId?: string;
  }) {
    let orgId = data.orgId;
    if (!orgId) {
      const [file] = await this.db
        .select({ orgId: schema.files.orgId })
        .from(schema.files)
        .where(eq(schema.files.id, data.fileId))
        .limit(1);
      orgId = file?.orgId || process.env.AUTH_DEFAULT_ORG_ID;
    }
    if (!orgId) {
      throw new Error(`Cannot create processing job: orgId missing for file ${data.fileId}`);
    }

    const result = await this.db
      .insert(schema.processingJobs)
      .values({
        orgId,
        fileId: data.fileId,
        jobType: data.jobType,
        status: data.status || 'pending',
        bullmqJobId: data.bullmqJobId,
      })
      .returning();
    return result[0];
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    errorMessage?: string,
  ) {
    const result = await this.db
      .update(schema.processingJobs)
      .set({
        status,
        errorMessage,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      })
      .where(eq(schema.processingJobs.id, id))
      .returning();
    return result[0];
  }

  async findByFileId(fileId: string) {
    return this.db
      .select()
      .from(schema.processingJobs)
      .where(eq(schema.processingJobs.fileId, fileId));
  }

  async findByBullmqJobId(bullmqJobId: string) {
    const result = await this.db
      .select()
      .from(schema.processingJobs)
      .where(eq(schema.processingJobs.bullmqJobId, bullmqJobId))
      .limit(1);
    return result[0] || null;
  }

  async updateStatusByBullmqJobId(
    bullmqJobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    errorMessage?: string,
  ) {
    const result = await this.db
      .update(schema.processingJobs)
      .set({
        status,
        errorMessage,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
        startedAt: status === 'processing' ? new Date() : undefined,
      })
      .where(eq(schema.processingJobs.bullmqJobId, bullmqJobId))
      .returning();
    return result[0] || null;
  }
}
