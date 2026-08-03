"use client";

import {
  ACTIVE_THEME_COOKIE,
  DEFAULT_THEME_NAME,
  isThemeName,
  themeBodyClass,
  type ThemeName,
} from "../config/themes";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ActiveThemeContextValue = {
  activeTheme: ThemeName;
  setActiveTheme: (theme: ThemeName | string) => void;
};

const ActiveThemeContext = createContext<ActiveThemeContextValue | undefined>(
  undefined,
);

function setThemeCookie(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "Secure;"
      : ""
  }`;
}

function applyThemeClass(theme: ThemeName) {
  if (typeof document === "undefined") return;

  Array.from(document.body.classList)
    .filter((cls) => cls.startsWith("theme-"))
    .forEach((cls) => document.body.classList.remove(cls));

  const nextClass = themeBodyClass(theme);
  if (nextClass) {
    document.body.classList.add(nextClass);
  }
}

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: string;
}) {
  const [activeTheme, setActiveThemeState] = useState<ThemeName>(() =>
    isThemeName(initialTheme) ? initialTheme : DEFAULT_THEME_NAME,
  );

  useEffect(() => {
    setThemeCookie(activeTheme);
    applyThemeClass(activeTheme);
  }, [activeTheme]);

  const setActiveTheme = useCallback((theme: ThemeName | string) => {
    setActiveThemeState(isThemeName(theme) ? theme : DEFAULT_THEME_NAME);
  }, []);

  const value = useMemo(
    () => ({ activeTheme, setActiveTheme }),
    [activeTheme, setActiveTheme],
  );

  return (
    <ActiveThemeContext.Provider value={value}>
      {children}
    </ActiveThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ActiveThemeContext);
  if (!context) {
    throw new Error("useThemeConfig must be used within ActiveThemeProvider");
  }
  return context;
}
