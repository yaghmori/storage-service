import { Injectable, Logger, Optional } from '@nestjs/common';
import { STORAGE_EVENT_TYPES } from '../contracts/kafka-topics';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
export class StorageLifecycleEventsService {
  private readonly logger = new Logger(StorageLifecycleEventsService.name);

  constructor(
    @Optional() private readonly publisher?: EventPublisherService,
  ) {}

  async fileUploaded(input: {
    fileId: string;
    orgId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    isDuplicate?: boolean;
  }) {
    await this.publish(STORAGE_EVENT_TYPES.UPLOADED, {
      fileId: input.fileId,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      tenantId: input.orgId,
      metadata: {
        isDuplicate: Boolean(input.isDuplicate),
      },
    });
  }

  async fileDeleted(input: {
    fileId: string;
    orgId: string;
    hardDelete?: boolean;
  }) {
    await this.publish(STORAGE_EVENT_TYPES.DELETED, {
      fileId: input.fileId,
      tenantId: input.orgId,
      metadata: {
        hardDelete: Boolean(input.hardDelete),
      },
    });
  }

  async fileProcessed(input: {
    fileId: string;
    orgId: string;
    processingStatus: string;
    processingError?: string | null;
  }) {
    await this.publish(STORAGE_EVENT_TYPES.PROCESSED, {
      fileId: input.fileId,
      processingType: input.processingStatus,
      tenantId: input.orgId,
      metadata: {
        processingStatus: input.processingStatus,
        processingError: input.processingError ?? null,
      },
    });
  }

  private async publish(
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    if (!this.publisher) {
      this.logger.debug(`Skip ${eventType}: EventPublisherService unavailable`);
      return;
    }
    try {
      await this.publisher.publishEventEnvelope({
        eventType,
        eventVersion: 1,
        source: 'storage-service',
        payload,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${eventType}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
