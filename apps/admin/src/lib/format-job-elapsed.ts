/**
 * Format job wall-clock duration from started/completed timestamps.
 * While still running, uses startedAt → now when completedAt is missing.
 */
export function formatJobElapsed(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  const end = completedAt ? Date.parse(completedAt) : nowMs;
  if (!Number.isFinite(end) || end < start) return null;
  return formatElapsedMs(end - start);
}

export function formatElapsedMs(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) {
    const frac = Math.floor((ms % 1000) / 100);
    return frac > 0 ? `${totalSec}.${frac}s` : `${totalSec}s`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}
