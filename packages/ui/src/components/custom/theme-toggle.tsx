"use client";

import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Icons } from "@workspace/ui/config/icons";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const handleThemeToggle = React.useCallback(
    (e?: React.MouseEvent) => {
      const newMode = resolvedTheme === "dark" ? "light" : "dark";
      const root = document.documentElement;

      if (!document.startViewTransition) {
        setTheme(newMode);
        return;
      }

      // Set coordinates from the click event
      if (e) {
        root.style.setProperty("--x", `${e.clientX}px`);
        root.style.setProperty("--y", `${e.clientY}px`);
      }

      document.startViewTransition(() => {
        setTheme(newMode);
      });
    },
    [resolvedTheme, setTheme]
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleThemeToggle}
      className="h-9 w-9 rounded-full"
    >
      {resolvedTheme === "dark" ? <Icons.sun /> : <Icons.moon />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
