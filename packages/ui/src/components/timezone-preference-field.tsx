"use client";

import { getBrowserTimezone } from "../lib/timezone-utils";
import { cn } from "../lib/utils";
import { TimezoneCombobox } from "./timezone-combobox";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import * as React from "react";

export interface TimezonePreferenceFieldProps {
  value?: string | null;
  onSave: (timeZone: string | null) => void | Promise<void>;
  isSaving?: boolean;
  className?: string;
  description?: string;
  showBrowserDefault?: boolean;
}

export function TimezonePreferenceField({
  value,
  onSave,
  isSaving = false,
  className,
  description = "Dates and appointment times will display in this timezone. Leave unset to use your browser timezone.",
  showBrowserDefault = true,
}: TimezonePreferenceFieldProps) {
  const browserTimezone = React.useMemo(() => getBrowserTimezone(), []);
  const [selected, setSelected] = React.useState(value ?? browserTimezone);
  const [useBrowserDefault, setUseBrowserDefault] = React.useState(!value);

  React.useEffect(() => {
    setSelected(value ?? browserTimezone);
    setUseBrowserDefault(!value);
  }, [value, browserTimezone]);

  const hasChanges = useBrowserDefault
    ? value != null
    : selected !== (value ?? browserTimezone);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <Label htmlFor="preferred-timezone">Preferred timezone</Label>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {showBrowserDefault ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useBrowserDefault}
            onChange={(event) => {
              const checked = event.target.checked;
              setUseBrowserDefault(checked);
              if (checked) {
                setSelected(browserTimezone);
              }
            }}
            className="size-4 rounded border-input"
          />
          <span>
            Use browser timezone ({browserTimezone})
          </span>
        </label>
      ) : null}

      <TimezoneCombobox
        value={selected}
        onValueChange={(next) => {
          setUseBrowserDefault(false);
          setSelected(next);
        }}
        className={cn(useBrowserDefault && showBrowserDefault && "opacity-60 pointer-events-none")}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={isSaving || !hasChanges}
          onClick={() => onSave(useBrowserDefault ? null : selected)}
        >
          {isSaving ? "Saving..." : "Save timezone"}
        </Button>
      </div>
    </div>
  );
}
