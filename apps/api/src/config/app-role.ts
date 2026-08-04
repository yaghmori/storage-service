/**
 * Process role flags for API vs worker split.
 * Defaults keep single-process backward compatibility (workers ON).
 */
function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

const workersDefault = parseBool(process.env.ENABLE_WORKERS, true);

export const appRole = {
  enableHttp: parseBool(process.env.ENABLE_HTTP, true),
  enableTcp: parseBool(process.env.ENABLE_TCP, parseBool(process.env.ENABLE_HTTP, true)),
  enableWorkers: workersDefault,
  /** Cron sweeps (integrity) — default follows workers. */
  enableCrons: parseBool(process.env.ENABLE_CRONS, workersDefault),
} as const;
