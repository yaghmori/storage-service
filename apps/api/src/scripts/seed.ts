/**
 * Production / local CLI: ensure Postgres DB exists, apply migrations, then
 * seed initial admin/org/provider data when missing.
 *
 * Usage:
 *   node dist/seed.js
 *   pnpm seed
 *   docker exec <container> seed
 *
 * Flags:
 *   --force   Seed even when orgs/providers already exist (admin still idempotent)
 */
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { runMigrations } from '../database/run-migrations';
import { SeedModule } from '../database/seed/seed.module';
import { SeedService } from '../database/seed/seed.service';

loadEnv({ path: '.env' });

async function main() {
  const force = process.argv.includes('--force');
  try {
    await runMigrations();

    // Avoid SeedBootstrapService double-running when RUN_SEED is set in the env.
    process.env.RUN_SEED = 'false';

    const app = await NestFactory.createApplicationContext(SeedModule, {
      logger: ['log', 'error', 'warn'],
    });
    try {
      const seedService = app.get(SeedService);
      await seedService.seed({ onlyIfEmpty: !force });
    } finally {
      await app.close();
    }

    console.log('[db] Seed completed');
    process.exit(0);
  } catch (error) {
    console.error('[db] Seed failed:', error);
    process.exit(1);
  }
}

void main();
