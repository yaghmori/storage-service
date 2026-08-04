/**
 * Production / local CLI: ensure the Postgres database exists, then apply
 * Drizzle migrations.
 *
 * Usage:
 *   node dist/migrate.js
 *   pnpm migrate
 *   docker exec <container> migrate
 */
import { config as loadEnv } from 'dotenv';
import { runMigrations } from '../database/run-migrations';

loadEnv({ path: '.env' });

async function main() {
  try {
    await runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('[db] Migration failed:', error);
    process.exit(1);
  }
}

void main();
