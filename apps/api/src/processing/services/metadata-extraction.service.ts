import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as exifr from 'exifr';
import { DatabaseService } from '../../database/database.service';
import * as schema from '../../database/drizzle/schema';
import { FilesService } from '../../files/services/files.service';

@Injectable()
export class MetadataExtractionService {
  constructor(
    private readonly filesService: FilesService,
    private readonly databaseService: DatabaseService,
  ) {}

  async extractMetadata(fileId: string) {
    const file = await this.filesService.findById(fileId);
    const provider = await this.filesService.getFileProvider(fileId);
    const fileBuffer = await provider.download(file.key);

    // Extract EXIF, IPTC, XMP metadata
    const allMetadata = await exifr.parse(fileBuffer, {
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

    // Store metadata in database (single source of truth)
    const db = this.databaseService.getDb();
    const existing = await db
      .select()
      .from(schema.fileMetadata)
      .where(eq(schema.fileMetadata.fileId, fileId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.fileMetadata)
        .set({
          metadata: allMetadata as unknown,
          updatedAt: new Date(),
        })
        .where(eq(schema.fileMetadata.fileId, fileId));
    } else {
      await db.insert(schema.fileMetadata).values({
        fileId,
        metadata: allMetadata as unknown,
      });
    }

    return allMetadata;
  }
}

