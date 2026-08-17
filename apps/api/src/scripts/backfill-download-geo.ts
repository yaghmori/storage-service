/**
 * Backfill country/region/city/lat/lon on existing download_logs rows from ip_address.
 *
 * Usage:
 *   pnpm --filter @yaghmori/storage-service-server exec tsx src/scripts/backfill-download-geo.ts
 */
import { config as loadEnv } from 'dotenv';
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { resolveDownloadGeo } from '../analytics/utils/geo-lookup';
import * as schema from '../database/drizzle/schema';

loadEnv({ path: '.env' });

const BATCH_SIZE = 200;

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/storage_service';

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  let updated = 0;
  let scanned = 0;

  for (;;) {
    const rows = await db
      .select({
        id: schema.downloadLogs.id,
        ipAddress: schema.downloadLogs.ipAddress,
      })
      .from(schema.downloadLogs)
      .where(
        and(
          isNotNull(schema.downloadLogs.ipAddress),
          isNull(schema.downloadLogs.countryCode),
          or(
            isNull(schema.downloadLogs.regionCode),
            eq(schema.downloadLogs.regionCode, ''),
          ),
        ),
      )
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const geo = resolveDownloadGeo({ ipAddress: row.ipAddress });
      await db
        .update(schema.downloadLogs)
        .set({
          countryCode: geo.countryCode,
          regionCode: geo.regionCode ?? 'OTHER',
          city: geo.city,
          latitude: geo.latitude,
          longitude: geo.longitude,
        })
        .where(eq(schema.downloadLogs.id, row.id));
      if (geo.countryCode) updated += 1;
    }

    console.log(`[backfill-download-geo] scanned=${scanned} updated=${updated}`);
  }

  console.log(
    `[backfill-download-geo] done scanned=${scanned} updated=${updated}`,
  );
  await pool.end();
}

void main().catch((error) => {
  console.error('[backfill-download-geo] failed:', error);
  process.exit(1);
});
