"use client";

import {
  Button,
  Card,
  CardContent,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import {
  DEFAULT_THEMES,
  type ThemeMode,
  type ThemeName,
} from "@workspace/ui/config/themes";
import { cn } from "@workspace/ui/lib/utils";
import { useThemeConfig } from "@workspace/ui/providers/active-theme";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountSettingsShell } from "./account-settings-shell";
import { SettingsHeading } from "./settings-heading";

function ThemeColorSwatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full border border-black/10 shadow-xs",
        className,
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export function AccountAppearanceView() {
  const { theme = "light", setTheme } = useTheme();
  const { activeTheme, setActiveTheme } = useThemeConfig();
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [themeName, setThemeName] = useState<ThemeName>(
    (activeTheme as ThemeName) || "default",
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    setThemeMode(theme === "dark" ? "dark" : "light");
    setThemeName((activeTheme as ThemeName) || "default");
  }, [mounted, theme, activeTheme]);

  const selectedTheme = DEFAULT_THEMES.find((t) => t.value === themeName);
  const dirty =
    themeMode !== (theme === "dark" ? "dark" : "light") ||
    themeName !== activeTheme;

  const onSave = () => {
    if (themeMode !== theme) setTheme(themeMode);
    if (themeName !== activeTheme) setActiveTheme(themeName);
    toast.success("Appearance saved on this device");
  };

  return (
    <AccountSettingsShell
      title="Appearance"
      description="Theme preferences for the admin console on this device."
    >
      <div className="flex flex-col gap-5">
        <SettingsHeading
          title="Appearance"
          description="Customize the look and feel of the admin interface."
        />

        <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
          <CardContent className="space-y-8 p-6">
            {!mounted ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={themeName}
                    onValueChange={(value) => {
                      if (value == null) return;
                      setThemeName(value as ThemeName);
                    }}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select a theme">
                        {selectedTheme ? (
                          <span className="flex items-center gap-2">
                            <ThemeColorSwatch color={selectedTheme.swatch} />
                            {selectedTheme.name}
                          </span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {DEFAULT_THEMES.map((themeItem) => (
                        <SelectItem
                          key={themeItem.value}
                          value={themeItem.value}
                        >
                          <span className="flex items-center gap-2">
                            <ThemeColorSwatch color={themeItem.swatch} />
                            {themeItem.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color theme.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Theme mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose light or dark mode.
                  </p>
                  <RadioGroup
                    onValueChange={(value) => {
                      if (value == null) return;
                      setThemeMode(value as ThemeMode);
                    }}
                    value={themeMode}
                    className="grid max-w-md grid-cols-2 gap-8 pt-2"
                  >
                    {(["light", "dark"] as const).map((mode) => {
                      const selected = themeMode === mode;
                      return (
                        <Label
                          key={mode}
                          className="flex cursor-pointer flex-col sm:flex-row"
                        >
                          <RadioGroupItem value={mode} className="sr-only" />
                          <div
                            className={cn(
                              "items-center rounded-md border-2 p-1 transition-colors",
                              selected
                                ? "border-primary ring-2 ring-primary/20"
                                : mode === "light"
                                  ? "border-muted hover:border-accent"
                                  : "border-muted bg-popover hover:border-accent",
                            )}
                          >
                            <div
                              className={cn(
                                "space-y-2 rounded-sm p-2",
                                mode === "light"
                                  ? "bg-[#ecedef]"
                                  : "bg-slate-950",
                              )}
                            >
                              <div
                                className={cn(
                                  "space-y-2 rounded-md p-2 shadow-xs",
                                  mode === "light"
                                    ? "bg-white"
                                    : "bg-slate-800",
                                )}
                              >
                                <div
                                  className={cn(
                                    "h-2 w-20 rounded-lg",
                                    mode === "light"
                                      ? "bg-[#ecedef]"
                                      : "bg-slate-400",
                                  )}
                                />
                                <div
                                  className={cn(
                                    "h-2 w-[100px] rounded-lg",
                                    mode === "light"
                                      ? "bg-[#ecedef]"
                                      : "bg-slate-400",
                                  )}
                                />
                              </div>
                              {[1, 2].map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-center space-x-2 rounded-md p-2 shadow-xs",
                                    mode === "light"
                                      ? "bg-white"
                                      : "bg-slate-800",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "h-4 w-4 rounded-full",
                                      mode === "light"
                                        ? "bg-[#ecedef]"
                                        : "bg-slate-600",
                                    )}
                                  />
                                  <div
                                    className={cn(
                                      "h-2 w-[100px] rounded-lg",
                                      mode === "light"
                                        ? "bg-[#ecedef]"
                                        : "bg-slate-400",
                                    )}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "block w-full p-2 text-center font-normal capitalize",
                              selected && "font-medium text-primary",
                            )}
                          >
                            {mode}
                          </span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="button"
            className="w-full min-w-52 md:w-auto"
            disabled={!mounted || !dirty}
            onClick={onSave}
          >
            Save changes
          </Button>
        </div>
      </div>
    </AccountSettingsShell>
  );
}
