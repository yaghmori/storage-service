import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'storage_service',
  },
  verbose: true,
  strict: true,
});

