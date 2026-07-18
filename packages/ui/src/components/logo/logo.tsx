"use client";
import { cn } from "@workspace/ui/lib/utils";
import { useTheme } from "next-themes";

export function Logo({
  className,
  logoUrl = "/logo.webp",
  showText = false,
}: {
  className?: string;
  showText?: boolean;
  logoUrl?: string;
}) {
  const theme = useTheme();

  return (
    <a
      href="/"
      className={cn(
        "flex items-center justify-center flex-row gap-2",

      )}
    >
      <div className={cn("bg-primary text-primary-foreground flex aspect-square min-w-8 min-h-8 items-center justify-center rounded-lg", className)}>
        <img
          className={`size-8 p-1 ${theme.theme === "dark" ? "invert" : ""}`}
          src={logoUrl}
          alt="logo"
        />
      </div>
      {showText && (
        <div
          className={cn(
            "text-primary-foreground grid flex-1 text-sm leading-tight"
          )}
        >
          <span className="text-primary truncate font-semibold">Allyfe</span>
          <span className="text-primary truncate text-xs">Dashboard</span>
        </div>
      )}
    </a>
  );
}
