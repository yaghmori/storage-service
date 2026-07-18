"use client";
import React, { createContext, useContext, useMemo, useState } from "react";

type ActiveTheme = string;

type ActiveThemeContextValue = {
  activeTheme: ActiveTheme;
  setActiveTheme: (theme: ActiveTheme) => void;
};

const ActiveThemeContext = createContext<ActiveThemeContextValue | undefined>(
  undefined
);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ActiveTheme;
}) {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(initialTheme);

  const value = useMemo(() => ({ activeTheme, setActiveTheme }), [activeTheme]);

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
