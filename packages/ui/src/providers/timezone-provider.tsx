"use client";

import {
  getBrowserTimezone,
  resolveTimezone,
  setActivePreferredTimeZone,
} from "@workspace/ui/lib/timezone-utils";
import * as React from "react";

interface TimezoneContextValue {
  /** Saved user preference (null = use browser). */
  preferredTimeZone: string | null;
  /** Browser-detected timezone. */
  browserTimezone: string;
  /** Effective timezone: preference first, then browser. */
  timezone: string;
}

const TimezoneContext = React.createContext<TimezoneContextValue | null>(null);

export interface TimezoneProviderProps {
  children: React.ReactNode;
  /** Saved user preference from profile API. Omit for unauthenticated users. */
  preferredTimeZone?: string | null;
}

export function TimezoneProvider({
  children,
  preferredTimeZone = null,
}: TimezoneProviderProps) {
  const normalizedPreference = preferredTimeZone?.trim() || null;
  const browserTimezone = React.useMemo(() => getBrowserTimezone(), []);
  const timezone = React.useMemo(
    () => resolveTimezone(normalizedPreference),
    [normalizedPreference],
  );

  // Keep axios interceptors in sync before child effects / queries run.
  setActivePreferredTimeZone(normalizedPreference);

  React.useEffect(() => {
    setActivePreferredTimeZone(normalizedPreference);
  }, [normalizedPreference]);

  const value = React.useMemo(
    () => ({
      preferredTimeZone: normalizedPreference,
      browserTimezone,
      timezone,
    }),
    [normalizedPreference, browserTimezone, timezone],
  );

  return (
    <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>
  );
}

export function usePreferredTimezone(): TimezoneContextValue {
  const context = React.useContext(TimezoneContext);
  if (context) return context;

  const browserTimezone = getBrowserTimezone();
  return {
    preferredTimeZone: null,
    browserTimezone,
    timezone: browserTimezone,
  };
}
