"use client";
import React from "react";

import { ActiveThemeProvider } from "../providers/active-theme";
import { Providers as NextThemesProvider } from "../providers/providers";

export default function ThemeProviders({
  activeThemeValue,
  children,
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        {children}
      </ActiveThemeProvider>
    </NextThemesProvider>
  );
}
