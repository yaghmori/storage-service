import { existsSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { ensureDatabaseExists } from './ensure-database';

function resolveMigrationsFolder(): string {
  if (process.env.MIGRATIONS_FOLDER?.trim()) {
    return path.resolve(process.env.MIGRATIONS_FOLDER.trim());
  }

  const candidates = [
    // Production API image: /app/src/database/drizzle/migrations
    path.join(process.cwd(), 'src/database/drizzle/migrations'),
    // Combined image when cwd is /app
    path.join(process.cwd(), 'api/src/database/drizzle/migrations'),
    // Relative to compiled dist/migrate.js
    path.join(__dirname, '..', 'src', 'database', 'drizzle', 'migrations'),
    path.join(__dirname, 'src', 'database', 'drizzle', 'migrations'),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'meta', '_journal.json'))) {
      return candidate;
    }
  }

  throw new Error(
    `Migrations folder not found. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}\n` +
      'Set MIGRATIONS_FOLDER to override.',
  );
}

export async function runMigrations(options?: {
  connectionString?: string;
  log?: (message: string) => void;
}): Promise<void> {
  const log = options?.log ?? console.log;
  const connectionString =
    options?.connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/storage_service';

  const ensured = await ensureDatabaseExists(connectionString, log);
  if (!ensured.created) {
    log(`[db] Database ${ensured.database} already exists`);
  }

  const migrationsFolder = resolveMigrationsFolder();
  log(`[db] Applying migrations from ${migrationsFolder}`);

  const client = postgres(connectionString, {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    log('[db] Migrations applied successfully');
  } finally {
    await client.end({ timeout: 5 });
  }
}
