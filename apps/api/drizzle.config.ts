import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env' });

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/database/drizzle/schema.ts'],
  out: './src/database/drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
