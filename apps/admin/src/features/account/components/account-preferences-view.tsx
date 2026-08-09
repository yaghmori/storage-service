"use client";

import { useLocalTimezonePreference } from "@/provider/local-timezone-provider";
import {
  Button,
  Card,
  CardContent,
  Label,
  TimezoneCombobox,
} from "@workspace/ui/components";
import { getBrowserTimezone } from "@workspace/ui/lib/timezone-utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountSettingsShell } from "./account-settings-shell";
import { SettingsHeading } from "./settings-heading";

export function AccountPreferencesView() {
  const { preferredTimeZone, setPreferredTimeZone } =
    useLocalTimezonePreference();
  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  const [selected, setSelected] = useState(
    preferredTimeZone ?? browserTimezone,
  );
  const [useBrowserDefault, setUseBrowserDefault] = useState(
    !preferredTimeZone,
  );

  useEffect(() => {
    setSelected(preferredTimeZone ?? browserTimezone);
    setUseBrowserDefault(!preferredTimeZone);
  }, [preferredTimeZone, browserTimezone]);

  const timezoneChanged = useBrowserDefault
    ? preferredTimeZone != null
    : selected !== (preferredTimeZone ?? browserTimezone);

  const onSave = () => {
    setPreferredTimeZone(useBrowserDefault ? null : selected);
    toast.success("Preferences saved on this device");
  };

  return (
    <AccountSettingsShell
      title="Preferences"
      description="Timezone preferences for this browser."
    >
      <div className="flex flex-col gap-5">
        <SettingsHeading
          title="Timezone"
          description="Dates and times in the admin console use this timezone. Stored on this device only."
        />

        <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>Preferred timezone</Label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={useBrowserDefault}
                  onChange={(e) => setUseBrowserDefault(e.target.checked)}
                />
                Use browser timezone ({browserTimezone})
              </label>
              <TimezoneCombobox
                value={selected}
                onValueChange={(value) => {
                  if (!useBrowserDefault) setSelected(value);
                }}
                className={
                  useBrowserDefault ? "pointer-events-none opacity-60" : undefined
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="button"
            className="w-full min-w-52 md:w-auto"
            disabled={!timezoneChanged}
            onClick={onSave}
          >
            Save preferences
          </Button>
        </div>
      </div>
    </AccountSettingsShell>
  );
}
