import { Client } from 'pg';

export type ParsedDatabaseUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

/** Parse postgres:// / postgresql:// URLs for admin + app connections. */
export function parseDatabaseUrl(connectionString: string): ParsedDatabaseUrl {
  const normalized = connectionString.trim();
  if (!normalized) {
    throw new Error('DATABASE_URL is empty');
  }

  const withProtocol = normalized.replace(/^postgres(ql)?:/i, 'http:');
  const url = new URL(withProtocol);
  const database = decodeURIComponent(url.pathname.replace(/^\//, '')).split(
    '/',
  )[0];
  if (!database) {
    throw new Error('DATABASE_URL must include a database name');
  }

  const sslmode = url.searchParams.get('sslmode')?.toLowerCase();
  const ssl =
    sslmode === 'require' ||
    sslmode === 'verify-ca' ||
    sslmode === 'verify-full' ||
    url.searchParams.get('ssl') === 'true';

  return {
    host: url.hostname || 'localhost',
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    database,
    ssl,
  };
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

/**
 * Connects to the maintenance DB (`postgres`) and creates the target database
 * when it does not exist. Safe to call from every process on boot (idempotent).
 */
export async function ensureDatabaseExists(
  connectionString: string,
  log: (message: string) => void = console.log,
): Promise<{ created: boolean; database: string }> {
  const parsed = parseDatabaseUrl(connectionString);
  const { database } = parsed;

  if (['postgres', 'template0', 'template1'].includes(database)) {
    return { created: false, database };
  }

  const admin = new Client({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: 'postgres',
    ssl: parsed.ssl ? { rejectUnauthorized: false } : false,
  });

  await admin.connect();
  try {
    const existing = await admin.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_database WHERE datname = $1
       ) AS exists`,
      [database],
    );
    if (existing.rows[0]?.exists) {
      return { created: false, database };
    }

    try {
      await admin.query(`CREATE DATABASE ${quoteIdent(database)}`);
      log(`[db] Created database ${database}`);
      return { created: true, database };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      // Another replica may have created it first.
      if (code === '42P04') {
        return { created: false, database };
      }
      if (code === '42501') {
        throw new Error(
          `Cannot create database "${database}": role lacks CREATEDB. ` +
            'Create the database manually or grant CREATEDB to the DATABASE_URL user.',
        );
      }
      throw error;
    }
  } finally {
    await admin.end().catch(() => undefined);
  }
}
