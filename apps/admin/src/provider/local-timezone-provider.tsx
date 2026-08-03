"use client";

import {
  readPreferredTimeZone,
  writePreferredTimeZone,
} from "@/lib/account-preferences";
import { TimezoneProvider } from "@workspace/ui/providers/timezone-provider";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocalTimezoneContextValue = {
  preferredTimeZone: string | null;
  setPreferredTimeZone: (value: string | null) => void;
};

const LocalTimezoneContext = createContext<LocalTimezoneContextValue | null>(
  null,
);

export function LocalTimezoneProvider({ children }: { children: ReactNode }) {
  const [preferredTimeZone, setPreferredTimeZoneState] = useState<string | null>(
    () => readPreferredTimeZone(),
  );

  const setPreferredTimeZone = useCallback((value: string | null) => {
    writePreferredTimeZone(value);
    setPreferredTimeZoneState(value?.trim() || null);
  }, []);

  const localValue = useMemo(
    () => ({ preferredTimeZone, setPreferredTimeZone }),
    [preferredTimeZone, setPreferredTimeZone],
  );

  return (
    <LocalTimezoneContext.Provider value={localValue}>
      <TimezoneProvider preferredTimeZone={preferredTimeZone}>
        {children}
      </TimezoneProvider>
    </LocalTimezoneContext.Provider>
  );
}

export function useLocalTimezonePreference(): LocalTimezoneContextValue {
  const ctx = useContext(LocalTimezoneContext);
  if (!ctx) {
    throw new Error(
      "useLocalTimezonePreference must be used within LocalTimezoneProvider",
    );
  }
  return ctx;
}
