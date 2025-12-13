import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/schema';

@Injectable()
export class ProcessingJobsRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: {
    fileId: string;
    jobType: string;
    status?: string;
    bullmqJobId?: string;
  }) {
    const result = await this.db
      .insert(schema.processingJobs)
      .values({
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
    status: string,
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
}

