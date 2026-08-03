"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AccountSettingsShell } from "./account-settings-shell";

const OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Bright workspace",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-light workspace",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Match your OS setting",
    icon: Monitor,
  },
] as const;

export function AccountAppearanceView() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <AccountSettingsShell
      title="Appearance"
      description="Theme preferences for the admin console."
    >
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose how Storage Admin looks on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mounted ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <RadioGroup
              value={theme ?? "system"}
              onValueChange={setTheme}
              className="grid gap-3 sm:grid-cols-3"
            >
              {OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`theme-${option.value}`}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <option.icon className="size-4" />
                      {option.label}
                    </div>
                    <RadioGroupItem
                      id={`theme-${option.value}`}
                      value={option.value}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>
    </AccountSettingsShell>
  );
}
