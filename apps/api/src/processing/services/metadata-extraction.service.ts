import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as exifr from 'exifr';
import { DatabaseService } from '../../database/database.service';
import * as schema from '../../database/drizzle/schema';
import { FilesService } from '../../files/services/files.service';

/**
 * PostgreSQL jsonb rejects U+0000 in strings. EXIF/IPTC often embeds null
 * bytes (e.g. ApplicationRecordVersion "\0\0"). Also normalize Dates/Buffers.
 */
function sanitizeForJsonb(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 20) return null;

  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('hex');
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJsonb(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof nested === 'function' || typeof nested === 'symbol') continue;
      const cleanKey = key.replace(/\u0000/g, '');
      if (!cleanKey) continue;
      out[cleanKey] = sanitizeForJsonb(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

@Injectable()
export class MetadataExtractionService {
  private readonly logger = new Logger(MetadataExtractionService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly databaseService: DatabaseService,
  ) {}

  async extractMetadata(fileId: string) {
    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);
    const fileBuffer = await provider.download(file.key);

    let allMetadata: Record<string, unknown> = {};

    try {
      const parsed = await exifr.parse(fileBuffer, {
        iptc: true,
        xmp: true,
        exif: true,
        gps: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true,
        sanitize: true,
        mergeOutput: true,
      });

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        allMetadata = sanitizeForJsonb(parsed) as Record<string, unknown>;
      }
    } catch (error) {
      this.logger.warn(
        `EXIF parse skipped for file ${fileId}: ${(error as Error).message}`,
      );
    }

    const db = this.databaseService.getDb();

    await db
      .insert(schema.fileMetadata)
      .values({
        fileId,
        metadata: allMetadata,
      })
      .onConflictDoUpdate({
        target: schema.fileMetadata.fileId,
        set: {
          metadata: allMetadata,
          updatedAt: new Date(),
        },
      });

    return allMetadata;
  }
}
