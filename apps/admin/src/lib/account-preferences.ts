const TIMEZONE_KEY = "admin.preferredTimeZone";

export function readPreferredTimeZone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(TIMEZONE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writePreferredTimeZone(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value?.trim()) {
      window.localStorage.removeItem(TIMEZONE_KEY);
      return;
    }
    window.localStorage.setItem(TIMEZONE_KEY, value.trim());
  } catch {
    // ignore quota / private mode
  }
}
